/*
 * esp32-firmware.ino
 * ESP32 Central Controller Firmware (Arduino Core) - UPDATED SERIAL LAYER
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <LiquidCrystal.h>

// =========================================================================
// 1. HARDWARE PIN CONFIGURATIONS
// =========================================================================
#define LCD_RS          33
#define LCD_E           25
#define LCD_D4          13
#define LCD_D5          23
#define LCD_D6          22
#define LCD_D7          21

#define PIC_RX_PIN      15   
#define PIC_TX_PIN      12   
#define BUTTON_PIN      2

// =========================================================================
// 2. NETWORK & SERVER PARAMETERS
// =========================================================================
const char* ssid = "secretPlace";
const char* password = "godswill90";
const char* serverUrl = "http://192.168.1"; 

// =========================================================================
// 3. SYSTEM STATE & TELEMETRY REGISTERS
// =========================================================================
struct BinTelemetry {
  uint16_t distance_mm;
  uint16_t weight_g;
  uint8_t status_flags;
  uint8_t lid_state;
  bool is_active;
  uint32_t last_update;
};

BinTelemetry bins[4]; 
uint8_t current_display_bin = 0;
uint32_t last_lcd_refresh = 0;

#define PACKET_SOF       0xAA
#define CMD_OPEN_LID     0x01

LiquidCrystal lcd(LCD_RS, LCD_E, LCD_D4, LCD_D5, LCD_D6, LCD_D7);

// =========================================================================
// 4. HARDWARE SETUP
// =========================================================================
void setup() {
  Serial.begin(115200);
  Serial.println("ESP32 Waste System Initializing...");

  // Initialize UART2 for PIC communication at 2400 Baud
  Serial2.begin(2400, SERIAL_8N1, PIC_RX_PIN, PIC_TX_PIN);
  Serial.println("UART2 (PIC Communication) Initialized at 2400 Baud.");

  pinMode(BUTTON_PIN, INPUT);

  lcd.begin(16, 2);
  lcd.setCursor(0, 0);
  lcd.print("System Booting...");

  for (int i = 0; i < 4; i++) {
    bins[i].is_active = false;
  }

  connectWiFi();
}

// =========================================================================
// 5. CORE SYSTEM LOOP
// =========================================================================
void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  pollPicUart();

  if (digitalRead(BUTTON_PIN) == HIGH) {
    delay(50); 
    if (digitalRead(BUTTON_PIN) == HIGH) {
      Serial.println("Action Button Pressed! Triggering waste event...");
      triggerClassificationEvent();
      while (digitalRead(BUTTON_PIN) == HIGH); 
    }
  }

  if (millis() - last_lcd_refresh > 3000) {
    last_lcd_refresh = millis();
    updateLcdDisplay();
    current_display_bin = (current_display_bin + 1) % 4; 
  }
}

// =========================================================================
// 6. FIXED UART PARSER STATE MACHINE
// =========================================================================
void pollPicUart() {
  static uint8_t rx_buffer[16];
  static uint8_t rx_index = 0;

  while (Serial2.available() > 0) {
    uint8_t c = Serial2.read();

    // State 0: Look for Start-Of-Frame Sync Byte
    if (rx_index == 0) {
      if (c == PACKET_SOF) {
        rx_buffer[rx_index++] = c;
      }
    }
    // State 1: Read the packet length byte
    else if (rx_index == 1) {
      if (c > 2 && c < sizeof(rx_buffer)) {
        rx_buffer[rx_index++] = c;
      } else {
        rx_index = 0; 
      }
    }
    // State 2: Accumulate payload and checksum
    else {
      rx_buffer[rx_index++] = c;
      
      // FIXED: Total length sent by PIC is exactly equal to the length byte value (9)
      uint8_t total_packet_size = rx_buffer[1]; 

      if (rx_index >= total_packet_size) {
        // The checksum byte sits at the absolute final slot of the message block
        uint8_t received_chk = rx_buffer[total_packet_size - 1];
        uint8_t computed_chk = 0;
        
        for (int i = 0; i < total_packet_size - 1; i++) {
          computed_chk ^= rx_buffer[i];
        }

        if (received_chk == computed_chk) {
          uint8_t binId = rx_buffer[2];
          if (binId < 4) {
            bins[binId].distance_mm = (rx_buffer[3] << 8) | rx_buffer[4];
            bins[binId].weight_g = (rx_buffer[5] << 8) | rx_buffer[6];
            bins[binId].status_flags = rx_buffer[7];
            bins[binId].lid_state = rx_buffer[8];
            bins[binId].is_active = true;
            bins[binId].last_update = millis();
          }
        } else {
          Serial.print("UART Error: Checksum mismatch from PIC. Expected: ");
          Serial.print(computed_chk, HEX);
          Serial.print(" Got: ");
          Serial.println(received_chk, HEX);
        }
        rx_index = 0; 
      }
    }
  }
}

// =========================================================================
// 7. HTTP API TELEMETRY POST PIPELINE
// =========================================================================
void triggerClassificationEvent() {
  int targetBin = -1;
  for (int i = 0; i < 4; i++) {
    if (bins[i].is_active && (millis() - bins[i].last_update < 4000)) {
      targetBin = i;
      break;
    }
  }

  if (targetBin == -1) {
    Serial.println("API Error: No active bin telemetry received from PIC recently.");
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Error: No Telemetry");
    lcd.setCursor(0, 1);
    lcd.print("PIC is Offline");
    delay(2000);
    return;
  }

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Classifying...");

  StaticJsonDocument<256> doc;
  String binLabel = "bin-" + String(targetBin + 1);

  float height_cm = bins[targetBin].distance_mm / 10.0;
  float weight_kg = bins[targetBin].weight_g / 1000.0;

  float empty_height_cm = 150.0;
  float fill_percent = ((empty_height_cm - height_cm) / empty_height_cm) * 100.0;
  if (fill_percent < 0.0) fill_percent = 0.0;
  if (fill_percent > 100.0) fill_percent = 100.0;

  bool sensor_fault = (bins[targetBin].status_flags & 0x01) == 0x01;

  doc["bin_id"] = binLabel;
  doc["fill_percent"] = fill_percent;
  doc["weight_kg"] = weight_kg;
  doc["height_cm"] = height_cm;
  doc["sensor_fault"] = sensor_fault;

  String jsonString;
  serializeJson(doc, jsonString);

  HTTPClient http;
  http.begin(serverUrl);
  http.addHeader("Content-Type", "application/json");

  int httpResponseCode = http.POST(jsonString);

  if (httpResponseCode == 200 || httpResponseCode == 201) {
    String responseString = http.getString();
    StaticJsonDocument<512> responseDoc;
    DeserializationError error = deserializeJson(responseDoc, responseString);

    if (!error) {
      const char* predictedClass = responseDoc["predicted_class"];
      double confidence = responseDoc["confidence_score"];

      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print(predictedClass);
      lcd.setCursor(0, 1);
      lcd.print("Conf: " + String((int)(confidence * 100)) + "%");

      sendActuationCommand(targetBin);
    }
  } else {
    lcd.clear();
    lcd.print("API Failed");
  }
  http.end();
  delay(3000); 
}

void sendActuationCommand(uint8_t binIndex) {
  uint8_t cmd_packet[5];
  cmd_packet[0] = PACKET_SOF;
  cmd_packet[1] = 0x05; // Total frame length: 5 bytes
  cmd_packet[2] = CMD_OPEN_LID;
  cmd_packet[3] = binIndex;

  uint8_t chk = 0;
  for (int i = 0; i < 4; i++) {
    chk ^= cmd_packet[i];
  }
  cmd_packet[4] = chk;

  Serial2.write(cmd_packet, 5);
  Serial.print("Sent UART command to open Lid for Bin ");
  Serial.println(binIndex + 1);
}

// =========================================================================
// 8. DISPLAY & NETWORKING UTILITIES
// =========================================================================
void connectWiFi() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("WiFi Connecting..");
  WiFi.begin(ssid, password);
  int retry = 0;
  while (WiFi.status() != WL_CONNECTED && retry < 20) {
    delay(500);
    retry++;
  }

  lcd.clear();
  if (WiFi.status() == WL_CONNECTED) {
    lcd.print("WiFi Connected!");
  } else {
    lcd.print("WiFi Offline");
  }
  delay(1000);
}

void updateLcdDisplay() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Bin-" + String(current_display_bin + 1) + " status:");

  if (!bins[current_display_bin].is_active || (millis() - bins[current_display_bin].last_update > 4000)) {
    lcd.setCursor(0, 1);
    lcd.print("Node Offline");
    return;
  }

  if ((bins[current_display_bin].status_flags & 0x01) == 0x01) {
    lcd.setCursor(0, 1);
    lcd.print("SENSOR FAULT");
  } else {
    float height_cm = bins[current_display_bin].distance_mm / 10.0;
    float empty_height_cm = 150.0;
    float fill_percent = ((empty_height_cm - height_cm) / empty_height_cm) * 100.0;
    if (fill_percent < 0.0) fill_percent = 0.0;
    if (fill_percent > 100.0) fill_percent = 100.0;

    float weight_kg = bins[current_display_bin].weight_g / 1000.0;

    lcd.setCursor(0, 1);
    lcd.print(String((int)fill_percent) + "% | " + String(weight_kg, 1) + "kg");
  }
}
