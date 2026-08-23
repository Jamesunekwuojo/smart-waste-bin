#include <PCB_2.h>
/*
 * main.c
 * PIC16F876A 4-Bin Controller - Core Drivers and Main Control Loop.
 * Compiler: CCS C Compiler (PCWHD)
 * 
 * DESCRIPTION:
 * This program runs the drivers for 4 independent waste bins on a single PIC16F876A.
 * It manages:
 *   1. Precise parallel readings from 4 HX711 load cell ADC modules.
 *   2. Sequential trigger/echo readings from 4 HC-SR04 ultrasonic sensors.
 *   3. 50Hz Software PWM for 4 SG90 servo motor lids using Timer0 interrupts.
 *   4. Checksum-validated UART telemetry packet transmission to the central ESP32.
 *   5. Receiving and parsing UART commands from the ESP32 to open specific bin lids.
 */


// =========================================================================
// 1. INTERRUPT SERVICE ROUTINE (ISR) - SOFTWARE PWM FOR SERVOS
// =========================================================================
// Timer0 overflows every 100 microseconds.
// Instruction frequency = 1MHz (4MHz crystal / 4).
// Prescaler of 2 means Timer0 increments every 2 microseconds.
// 100 microseconds / 2 = 50 timer ticks.
// Preloading Timer0 with 206 (256 - 50) triggers the interrupt every 100us.
#int_rtcc
void timer0_isr(void) {
    set_timer0(206); // Reload Timer0 for next 100us tick
    
    // Increment the software PWM period counter (0 to 199 = 20ms period)
    pwm_tick_count++;
    if (pwm_tick_count >= SERVO_CYCLE_TICKS) {
        pwm_tick_count = 0;
        
        // Start of new 20ms period: set all servo control lines HIGH
        output_high(SERVO_BIN1);
        output_high(SERVO_BIN2);
        output_high(SERVO_BIN3);
        output_high(SERVO_BIN4);
    }
    
    // For each servo, turn the signal LOW once its target width has been reached
    if (pwm_tick_count == servo_target_ticks[0]) {
        output_low(SERVO_BIN1);
    }
    if (pwm_tick_count == servo_target_ticks[1]) {
        output_low(SERVO_BIN2);
    }
    if (pwm_tick_count == servo_target_ticks[2]) {
        output_low(SERVO_BIN3);
    }
    if (pwm_tick_count == servo_target_ticks[3]) {
        output_low(SERVO_BIN4);
    }
}

// =========================================================================
// 2. HARDWARE INITIALIZATION
// =========================================================================
void init_hardware(void) {
    // Disable analog features on Port A pins (RA0-RA3 must be digital inputs for HX711)
    setup_adc_ports(NO_ANALOGS);
    setup_adc(ADC_OFF);
    
    // Configure Pin Directions (1 = Input, 0 = Output)
    // Port A: RA0-RA3 are input data lines for HX711
    set_tris_a(0b00001111);
    
    // Port B: RB4-RB7 are inputs (Echos), RB1-RB3 are outputs (Triggers 2-4), RB0 is input
    set_tris_b(0b11110000);
    
    // Port C: RC0=Output (Trig1), RC1=Output (HX711 SCK), RC2-RC5=Outputs (Servos),
    // RC6=Output (UART TX), RC7=Input (UART RX)
    set_tris_c(0b10000000);
    
    // Set initial output pin states
    output_low(HX711_SCK);
    output_low(TRIG_BIN1);
    output_low(TRIG_BIN2);
    output_low(TRIG_BIN3);
    output_low(TRIG_BIN4);
    
    // Configure Timer0 for Software PWM (internal instruction clock, prescaler = 2)
    setup_timer_0(RTCC_INTERNAL | RTCC_DIV_2);
    set_timer0(206); // Initial load for 100us
    
    // Configure Timer1 for Ultrasonic Echo pulse timing
    // Timer1 increments every 1 microsecond (1MHz clock, prescaler = 1)
    setup_timer_1(T1_INTERNAL | T1_DIV_BY_1);
    setup_timer_1(T1_DISABLED); // Keep off until needed
    
    // Enable Timer0 and Global interrupts
    enable_interrupts(INT_RTCC);
    enable_interrupts(GLOBAL);
}

// =========================================================================
// 3. ULTRASONIC SENSOR DRIVER (SEQUENTIAL POLLING)
// =========================================================================
// Reads a single ultrasonic sensor. Polling sequentially prevents cross-talk 
// where acoustic waves from one bin trigger a false reading in an adjacent bin.
uint16_t read_single_ultrasonic(uint8_t bin_index) {
    uint16_t time_count = 0;
    uint32_t timeout_counter = 0;
    
    // Disable global interrupts briefly to ensure precise 10us trigger pulse
    disable_interrupts(GLOBAL);
    
    // Send 10 microsecond trigger pulse to the selected bin
    switch(bin_index) {
        case 0: output_high(TRIG_BIN1); delay_us(10); output_low(TRIG_BIN1); break;
        case 1: output_high(TRIG_BIN2); delay_us(10); output_low(TRIG_BIN2); break;
        case 2: output_high(TRIG_BIN3); delay_us(10); output_low(TRIG_BIN3); break;
        case 3: output_high(TRIG_BIN4); delay_us(10); output_low(TRIG_BIN4); break;
    }
    
    enable_interrupts(GLOBAL); // Re-enable interrupts for software PWM
    
    // 1. Wait for Echo pin to go HIGH (with timeout)
    timeout_counter = 0;
    switch(bin_index) {
        case 0: while(!input(ECHO_BIN1) && ++timeout_counter < 10000); break;
        case 1: while(!input(ECHO_BIN2) && ++timeout_counter < 10000); break;
        case 2: while(!input(ECHO_BIN3) && ++timeout_counter < 10000); break;
        case 3: while(!input(ECHO_BIN4) && ++timeout_counter < 10000); break;
    }
    
    // If waiting for echo timed out, sensor is disconnected/faulty
    if (timeout_counter >= 10000) {
        return 0xFFFF; // Return fault sentinel
    }
    
    // 2. Start Timer1 to measure the pulse width
    set_timer1(0);
    setup_timer_1(T1_INTERNAL | T1_DIV_BY_1);
    
    // 3. Wait for Echo pin to go LOW (with timeout of ~30ms / 30,000us)
    timeout_counter = 0;
    switch(bin_index) {
        case 0: while(input(ECHO_BIN1) && ++timeout_counter < 30000); break;
        case 1: while(input(ECHO_BIN2) && ++timeout_counter < 30000); break;
        case 2: while(input(ECHO_BIN3) && ++timeout_counter < 30000); break;
        case 3: while(input(ECHO_BIN4) && ++timeout_counter < 30000); break;
    }
    
    // Read Timer1 and disable it
    time_count = get_timer1();
    setup_timer_1(T1_DISABLED);
    
    if (timeout_counter >= 30000) {
        return 0xFFFF; // Echo hung or didn't return
    }
    
    // Distance in mm = (time in microseconds * speed of sound 0.343 mm/us) / 2
    // Simplify float math to preserve PIC memory: distance_mm = (time_count * 343) / 2000
    uint32_t raw_dist = ((uint32_t)time_count * 343) / 2000;
    
    if (raw_dist > MAX_DISTANCE_MM) {
        return MAX_DISTANCE_MM; // Clamp out-of-bounds readings
    }
    
    return (uint16_t)raw_dist;
}

void read_all_ultrasonic(void) {
    uint8_t i;
    for (i = 0; i < 4; i++) {
        uint16_t dist = read_single_ultrasonic(i);
        if (dist == 0xFFFF) {
            bin_status_flags[i] |= 0x01; // Flag sensor fault
            bin_distance_mm[i] = 0;
        } else {
            bin_status_flags[i] &= ~0x01; // Clear fault flag
            bin_distance_mm[i] = dist;
        }
        delay_ms(15); // Short cooling delay to prevent overlapping acoustic reflection
    }
}

// =========================================================================
// 4. HX711 LOAD CELL DRIVER (PARALLEL SYNCHRONOUS READ)
// =========================================================================
// Reads all four HX711 modules in parallel by shifting data out of all four
// DT pins simultaneously on every clock cycle. This saves substantial time.
void read_all_load_cells(void) {
    uint32_t raw_val[4] = {0, 0, 0, 0};
    uint8_t i, j;
    uint32_t timeout_counter = 0;
    
    // Wait for all four HX711 channels to pull DT low (signals data is ready)
    // If any sensor hangs, timeout after 250ms to prevent loop blockage.
    while ((input(HX711_DT_BIN1) || input(HX711_DT_BIN2) || 
            input(HX711_DT_BIN3) || input(HX711_DT_BIN4)) && ++timeout_counter < 250000) {
        delay_us(1);
    }
    
    if (timeout_counter >= 250000) {
        // Telemetry communication/sensor fault occurred on one or more cells
        for (i = 0; i < 4; i++) {
            bin_status_flags[i] |= 0x01; 
            bin_weight_g[i] = 0;
        }
        return;
    }
    
    // Read 24 bits from all sensors in parallel
    for (i = 0; i < 24; i++) {
        output_high(HX711_SCK);
        delay_us(1); // Set clock duration
        
        // Shift bits in
        for (j = 0; j < 4; j++) {
            raw_val[j] = raw_val[j] << 1;
        }
        
        output_low(HX711_SCK);
        delay_us(1);
        
        // Read each DT pin state
        if (input(HX711_DT_BIN1)) raw_val[0] |= 1;
        if (input(HX711_DT_BIN2)) raw_val[1] |= 1;
        if (input(HX711_DT_BIN3)) raw_val[2] |= 1;
        if (input(HX711_DT_BIN4)) raw_val[3] |= 1;
    }
    
    // 25th clock pulse: Resets HX711 and sets next conversion gain to 128 (Channel A)
    output_high(HX711_SCK);
    delay_us(1);
    output_low(HX711_SCK);
    delay_us(1);
    
    // Sign extend 24-bit value to 32-bit signed integers and calculate weight
    for (i = 0; i < 4; i++) {
        int32_t val = raw_val[i];
        if (val & 0x800000) {
            val |= 0xFF000000; // Sign extend if negative
        }
        
        // Convert to grams using offset and calibration scale
        float weight = ((float)(val - HX711_OFFSET)) / HX711_SCALE;
        
        if (weight < 0) {
            weight = 0; // Clamp small negative drift values at 0g
        }
        
        if (weight > MAX_WEIGHT_G) {
            bin_weight_g[i] = MAX_WEIGHT_G;
            bin_status_flags[i] |= 0x01; // Flag sensor fault if out of limits
        } else {
            bin_weight_g[i] = (uint16_t)weight;
            bin_status_flags[i] &= ~0x01; // Clear fault flag
        }
    }
}

// =========================================================================
// 5. SERVO LID ACTUATION LOGIC
// =========================================================================
void set_lid_state(uint8_t bin_index, int1_t open) {
    if (bin_index >= 4) return;
    
    if (open) {
        servo_target_ticks[bin_index] = SERVO_OPEN_TICKS;
        servo_state[bin_index] = 1;
        servo_open_timer[bin_index] = SERVO_OPEN_DURATION_MS; // Set countdown value
    } else {
        servo_target_ticks[bin_index] = SERVO_CLOSED_TICKS;
        servo_state[bin_index] = 0;
        servo_open_timer[bin_index] = 0;
    }
}

// Checks if any open lids have reached their timeout and auto-closes them
void check_auto_close_timers(void) {
    uint8_t i;
    for (i = 0; i < 4; i++) {
        if (servo_state[i] && servo_open_timer[i] > 0) {
            // Subtract main loop delay cycle time (~250ms)
            if (servo_open_timer[i] > 250) {
                servo_open_timer[i] -= 250;
            } else {
                set_lid_state(i, 0); // Trigger auto-close
            }
        }
    }
}

// =========================================================================
// 6. UART PROTOCOL LAYER (COMMUNICATION WITH ESP32)
// =========================================================================

// Sends an 8-byte status telemetry packet to the ESP32 for the specified bin index
void send_telemetry_packet(uint8_t bin_index) {
    uint8_t packet[9];
    uint8_t i;
    
    packet[0] = PACKET_SOF;
    packet[1] = 0x09; // Packet length: 9 bytes
    packet[2] = bin_index;
    packet[3] = (uint8_t)(bin_distance_mm[bin_index] >> 8);   // Distance MSB
    packet[4] = (uint8_t)(bin_distance_mm[bin_index] & 0xFF);  // Distance LSB
    packet[5] = (uint8_t)(bin_weight_g[bin_index] >> 8);       // Weight MSB
    packet[6] = (uint8_t)(bin_weight_g[bin_index] & 0xFF);      // Weight LSB
    packet[7] = bin_status_flags[bin_index];
    packet[8] = (uint8_t)servo_state[bin_index];
    
    uint8_t chk = compute_checksum(packet, 9);
    
    // Stream packet to ESP32
    for (i = 0; i < 9; i++) {
        fputc(packet[i], HOST_ESP32);
    }
    fputc(chk, HOST_ESP32); // Send the final checksum byte
}

uint8_t compute_checksum(uint8_t *packet, uint8_t len) {
    uint8_t result = 0;
    uint8_t i;
    for (i = 0; i < len; i++) {
        result ^= packet[i];
    }
    return result;
}

// Checks the serial buffer and parses incoming ESP32 command frames
void process_incoming_uart(void) {
    while (kbhit(HOST_ESP32)) {
        uint8_t c = fgetc(HOST_ESP32);
        
        // State 0: Wait for Start of Frame (0xAA)
        if (rx_index == 0) {
            if (c == PACKET_SOF) {
                rx_buffer[rx_index++] = c;
            }
        } 
        // State 1: Read length byte
        else if (rx_index == 1) {
            if (c > 0 && c < RX_BUFFER_LEN) {
                rx_buffer[rx_index++] = c;
            } else {
                rx_index = 0; // Invalid packet size, reset parser
            }
        } 
        // State 2: Accumulate payload bytes + checksum
        else {
            rx_buffer[rx_index++] = c;
            
            // Telemetry uses length 9 for SOF + 8 data bytes. The ESP32
            // command uses length 3 for command + bin ID, then adds SOF and checksum.
            uint8_t expected_total_len;
            if (rx_buffer[1] == 0x03) {
                expected_total_len = 5;
            } else {
                expected_total_len = rx_buffer[1] + 1;
            }
            if (rx_index >= expected_total_len) {
                // Extract checksum byte
                uint8_t received_chk = rx_buffer[expected_total_len - 1];
                uint8_t computed_chk = compute_checksum(rx_buffer, expected_total_len - 1);
                
                if (received_chk == computed_chk) {
                    // Command packet syntax: [0xAA] [Length] [Command] [BinID] [Checksum]
                    uint8_t command = rx_buffer[2];
                    uint8_t target_bin = rx_buffer[3];
                    
                    if (command == CMD_OPEN_LID && target_bin < 4) {
                        set_lid_state(target_bin, 1); // Open the lid for target bin
                    }
                }
                rx_index = 0; // Reset parser for next message
            }
        }
    }
}

// =========================================================================
// 7. MAIN PROGRAM SYSTEM LOOP
// =========================================================================
void main(void) {
    delay_ms(500); // Power-up delay for target sensor boards
    init_hardware();
    
    while(TRUE) {
        // 1. Gather distance measurements sequentially from the 4 bins
        read_all_ultrasonic();
        
        // 2. Gather load readings in parallel from the 4 HX711 ADCs
        read_all_load_cells();
        
        // 3. Process any actuation command arriving from the ESP32
        process_incoming_uart();
        
        // 4. Auto-close any lids that have timed out
        check_auto_close_timers();
        
        // 5. Transmit telemetry status packets to the ESP32
        uint8_t i;
        for (i = 0; i < 4; i++) {
            send_telemetry_packet(i);
        }
        
        // Loop execution rate delay (~4Hz sampling)
        delay_ms(250); 
    }
}
