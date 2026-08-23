/*
 * esp32-firmware.ino
 * ESP32 Central Controller Firmware (Arduino Core)
 *
 * DESCRIPTION:
 * This program acts as the central controller for the smart waste bin system.
 * It manages:
 *   1. Wi-Fi connection and reconnect state machine.
 *   2. Non-blocking UART serial communication to receive 4-bin telemetry from the PIC16F876A.
 *   3. PC-side diagnostic logging (over Serial0 @ 115200 baud).
 *   4. A parallel (4-bit) character LCD to show bin capacities and server predictions.
 *   5. A physical trigger button to initiate waste processing.
 *   6. Sending HTTP POST JSON payloads to the Flask API backend.
 *   7. Sending UART actuation commands to the PIC to open specific bin lids based on API results.
 *
 * PIN MAPPING NOTES (aligned to project schematic):
 *   - LCD is wired in parallel 4-bit mode (RS, E, D4-D7) with a contrast pot (RV2),
 *     NOT an I2C backpack module. LiquidCrystal_I2C has been replaced with LiquidCrystal.
 *   - PIC runs its logic at 5V; ESP32 runs at 3.3V. The PIC->ESP32 UART line
 *     (PIC TX -> ESP32 RX2) passes through a 1k/2k resistor divider on the
 *     board to safely step 5V down to ~3.3V. ESP32->PIC (TX2 -> PIC RX) needs
 *     no divider, since 3.3V reliably registers as HIGH on the PIC's 5V input.
 *   - Button is wired with an external 10k pull-down to GND (active-HIGH when
 *     pressed), so the internal INPUT_PULLUP + active-LOW logic used in the
 *     original version has been corrected to match.
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <LiquidCrystal.h>

// =========================================================================
// 1. HARDWARE PIN CONFIGURATIONS (matched to project schematic)
// =========================================================================

// --- LCD (parallel 4-bit mode) ---
#define LCD_RS          33
#define LCD_E           25
#define LCD_D4          13
#define LCD_D5          23
#define LCD_D6          22
#define LCD_D7          21

// --- UART to PIC (Serial2) ---
#define PIC_RX_PIN      15   // ESP32 RX2 <- PIC TX (RC6), via 1k/2k divider on board
#define PIC_TX_PIN      12   // ESP32 TX2 -> PIC RX (RC7), direct, no divider needed

// --- Trigger Button (external 10k pull-down to GND -> active-HIGH when pressed) ---
#define BUTTON_PIN      2

// NOTE: Camera pins (D0-D7, HREF, VSYNC, PCLK, XCLK, SIOD, SIOC) are handled
// separately in the camera driver init and are not redefined here to avoid
// duplicate/conflicting pin definitions across files.

// =========================================================================
// 2. NETWORK & SERVER PARAMETERS
// =========================================================================
const char* ssid = "secretPlace";
const char* password = "godswill90";

// Flask server backend URL
const char* serverUrl = "http://192.168.1.100:5000/api/waste"; // Replace with your Flask server IP

// =========================================================================
// 3. SYSTEM STATE & TELEMETRY REGISTERS
// =========================================================================
// Struct matching the PIC status telemetry packet
struct BinTelemetry {
  uint16_t distance_mm;
  uint16_t weight_g;
  uint8_t status_flags;
  uint8_t lid_state;
  bool is_active;
  uint32_t last_update;
};

BinTelemetry bins[4]; // Telemetry cache for the 4 bins
uint8_t current_display_bin = 0;
uint32_t last_lcd_refresh = 0;

// UART Parser State Machine Constants
#define PACKET_SOF       0xAA
#define CMD_OPEN_LID     0x01

// Setup parallel LCD (16 columns x 2 rows)
LiquidCrystal lcd(LCD_RS, LCD_E, LCD_D4, LCD_D5, LCD_D6, LCD_D7);

// =========================================================================
// 4. HARDWARE SETUP
// =========================================================================
void setup() {
  // Initialize Serial Monitor (USB debugging to PC)
  Serial.begin(115200);
  Serial.println("ESP32 Waste System Initializing...");

  // Initialize UART2 for PIC communication (2400 Baud, 8-N-1 formatting)
  Serial2.begin(2400, SERIAL_8N1, PIC_RX_PIN, PIC_TX_PIN);
  Serial.println("UART2 (PIC Communication) Initialized at 2400 Baud.");

  // Initialize trigger button.
  // Board has an external 10k pull-down to GND, so the pin idles LOW and
  // reads HIGH when pressed. No internal pull-up/pull-down needed.
  pinMode(BUTTON_PIN, INPUT);

  // Initialize parallel LCD Display
  lcd.begin(16, 2);
  lcd.setCursor(0, 0);
  lcd.print("System Booting...");

  // Initialize Telemetry Cache
  for (int i = 0; i < 4; i++) {
    bins[i].distance_mm = 0;
    bins[i].weight_g = 0;
    bins[i].status_flags = 0;
    bins[i].lid_state = 0;
    bins[i].is_active = false;
    bins[i].last_update = 0;
  }

  // Connect to WiFi
  connectWiFi();
}

// =========================================================================
// 5. CORE SYSTEM LOOP
// =========================================================================
void loop() {
  // 1. Maintain WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  // 2. Poll and parse UART data from the PIC microcontroller
  pollPicUart();

  // 3. Scan the trigger button (active-HIGH via external pull-down, check for press transition)
  if (digitalRead(BUTTON_PIN) == HIGH) {
    delay(50); // Debounce delay
    if (digitalRead(BUTTON_PIN) == HIGH) {
      Serial.println("Action Button Pressed! Triggering waste event...");
      triggerClassificationEvent();
      while (digitalRead(BUTTON_PIN) == HIGH); // Wait for release
    }
  }

  // 4. Periodically cycle the LCD display between the 4 Bins
  if (millis() - last_lcd_refresh > 3000) {
    last_lcd_refresh = millis();
    updateLcdDisplay();
    current_display_bin = (current_display_bin + 1) % 4; // Cycle 0 -> 1 -> 2 -> 3
  }
}

// =========================================================================
// 6. UART PARSER STATE MACHINE
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
      if (c > 0 && c < sizeof(rx_buffer)) {
        rx_buffer[rx_index++] = c;
      } else {
        rx_index = 0; // Out-of-bounds size, discard packet
      }
    }
    // State 2: Accumulate payload and checksum
    else {
      rx_buffer[rx_index++] = c;
      uint8_t expected_len = rx_buffer[1] + 1; // payload size + checksum byte

      if (rx_index >= expected_len) {
        // Full packet received. Perform checksum validation.
        uint8_t received_chk = rx_buffer[expected_len - 1];
        uint8_t computed_chk = 0;
        for (int i = 0; i < expected_len - 1; i++) {
          computed_chk ^= rx_buffer[i];
        }

        if (received_chk == computed_chk) {
          // Packet parsing syntax: [SOF] [Len] [BinID] [DistMSB] [DistLSB] [WeightMSB] [WeightLSB] [Flags] [LidState] [Checksum]
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
          Serial.println("UART Error: Checksum mismatch from PIC.");
        }
        rx_index = 0; // Reset parser state
      }
    }
  }
}

// =========================================================================
// 7. HTTP API TELEMETRY POST PIPELINE
// =========================================================================
void triggerClassificationEvent() {
  // Find which bin has active telemetry. In a production physical build,
  // this is determined by proximity, IR trigger, or a selected active bin.
  // For this prototype, we choose the first bin that is reporting active connection.
  int targetBin = -1;
  for (int i = 0; i < 4; i++) {
    if (bins[i].is_active && (millis() - bins[i].last_update < 2000)) {
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
  lcd.setCursor(0, 1);
  lcd.print("Sending to API");

  // Create JSON payload using ArduinoJson library
  StaticJsonDocument<256> doc;
  String binLabel = "bin-" + String(targetBin + 1); // e.g. "bin-1", "bin-2"

  // Convert mm to cm and grams to kg to align with backend schema
  float height_cm = bins[targetBin].distance_mm / 10.0;
  float weight_kg = bins[targetBin].weight_g / 1000.0;

  // Calculate fill percentage (based on empty height of 1500mm / 150cm)
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
  Serial.print("POST Payload: ");
  Serial.println(jsonString);

  // Send HTTP POST Request
  HTTPClient http;
  http.begin(serverUrl);
  http.addHeader("Content-Type", "application/json");

  int httpResponseCode = http.POST(jsonString);

  if (httpResponseCode == 200 || httpResponseCode == 201) {
    String responseString = http.getString();
    Serial.print("Response: ");
    Serial.println(responseString);

    // Parse classification result from server response
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

      Serial.print("Server predicted class: ");
      Serial.println(predictedClass);

      // Send command to PIC to open the lid for this bin
      sendActuationCommand(targetBin);
    } else {
      Serial.println("JSON Parsing Error.");
      lcd.clear();
      lcd.print("JSON Error");
    }
  } else {
    Serial.print("HTTP POST Failed. Response Code: ");
    Serial.println(httpResponseCode);
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("API Failed");
    lcd.setCursor(0, 1);
    lcd.print("Code: " + String(httpResponseCode));
  }

  http.end();
  delay(3000); // Display the server prediction on LCD for 3 seconds
}

// Sends an actuation command packet over UART to open a specific bin lid
void sendActuationCommand(uint8_t binIndex) {
  uint8_t cmd_packet[4];
  cmd_packet[0] = PACKET_SOF;
  cmd_packet[1] = 0x03; // Payload length: 3 bytes
  cmd_packet[2] = CMD_OPEN_LID;
  cmd_packet[3] = binIndex;

  uint8_t chk = 0;
  for (int i = 0; i < 4; i++) {
    chk ^= cmd_packet[i];
  }

  // Write packet to Serial2 (to PIC RX)
  Serial2.write(cmd_packet, 4);
  Serial2.write(chk);
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
  lcd.setCursor(0, 1);
  lcd.print(ssid);

  WiFi.begin(ssid, password);
  int retry = 0;
  while (WiFi.status() != WL_CONNECTED && retry < 20) {
    delay(500);
    Serial.print(".");
    retry++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi Connected successfully!");
    lcd.clear();
    lcd.print("WiFi Connected!");
    lcd.setCursor(0, 1);
    lcd.print(WiFi.localIP());
  } else {
    Serial.println("\nWiFi Connection Failed.");
    lcd.clear();
    lcd.print("WiFi Offline");
  }
  delay(1500);
}

void updateLcdDisplay() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Bin-" + String(current_display_bin + 1) + " status:");

  if (!bins[current_display_bin].is_active || (millis() - bins[current_display_bin].last_update > 3000)) {
    lcd.setCursor(0, 1);
    lcd.print("Node Offline");
    return;
  }

  if ((bins[current_display_bin].status_flags & 0x01) == 0x01) {
    lcd.setCursor(0, 1);
    lcd.print("SENSOR FAULT");
  } else {
    // Convert mm height to fill percentage (assuming 1500mm depth)
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