#include <PCB_2.h>

// =========================================================================
// 1. INTERRUPT SERVICE ROUTINE (ISR) - SOFTWARE PWM FOR SERVOS
// =========================================================================
#int_rtcc
void timer0_isr(void) {
    set_timer0(206); 
    
    pwm_tick_count++;
    if (pwm_tick_count >= SERVO_CYCLE_TICKS) {
        pwm_tick_count = 0;
        output_high(SERVO_BIN1);
        output_high(SERVO_BIN2);
        output_high(SERVO_BIN3);
        output_high(SERVO_BIN4);
    }
    
    if (pwm_tick_count == servo_target_ticks[0]) output_low(SERVO_BIN1);
    if (pwm_tick_count == servo_target_ticks[1]) output_low(SERVO_BIN2);
    if (pwm_tick_count == servo_target_ticks[2]) output_low(SERVO_BIN3);
    if (pwm_tick_count == servo_target_ticks[3]) output_low(SERVO_BIN4);
}

// =========================================================================
// 2. HARDWARE INITIALIZATION
// =========================================================================
void init_hardware(void) {
    setup_adc_ports(NO_ANALOGS);
    setup_adc(ADC_OFF);
    
    set_tris_a(0b00001111);
    set_tris_b(0b11110000);
    set_tris_c(0b10000000);
    
    output_low(HX711_SCK);
    output_low(TRIG_BIN1);
    output_low(TRIG_BIN2);
    output_low(TRIG_BIN3);
    output_low(TRIG_BIN4);
    
    setup_timer_0(RTCC_INTERNAL | RTCC_DIV_2);
    set_timer0(206); 
    
    setup_timer_1(T1_INTERNAL | T1_DIV_BY_1);
    setup_timer_1(T1_DISABLED); 
    
    enable_interrupts(INT_RTCC);
    enable_interrupts(GLOBAL);
}

// =========================================================================
// 3. ULTRASONIC SENSOR DRIVER
// =========================================================================
uint16_t read_single_ultrasonic(uint8_t bin_index) {
    uint16_t time_count = 0;
    uint32_t timeout_counter = 0;
    
    disable_interrupts(GLOBAL);
    switch(bin_index) {
        case 0: output_high(TRIG_BIN1); delay_us(10); output_low(TRIG_BIN1); break;
        case 1: output_high(TRIG_BIN2); delay_us(10); output_low(TRIG_BIN2); break;
        case 2: output_high(TRIG_BIN3); delay_us(10); output_low(TRIG_BIN3); break;
        case 3: output_high(TRIG_BIN4); delay_us(10); output_low(TRIG_BIN4); break;
    }
    enable_interrupts(GLOBAL); 
    
    timeout_counter = 0;
    switch(bin_index) {
        case 0: while(!input(ECHO_BIN1) && ++timeout_counter < 10000); break;
        case 1: while(!input(ECHO_BIN2) && ++timeout_counter < 10000); break;
        case 2: while(!input(ECHO_BIN3) && ++timeout_counter < 10000); break;
        case 3: while(!input(ECHO_BIN4) && ++timeout_counter < 10000); break;
    }
    
    if (timeout_counter >= 10000) return 0xFFFF; 
    
    set_timer1(0);
    setup_timer_1(T1_INTERNAL | T1_DIV_BY_1);
    
    timeout_counter = 0;
    switch(bin_index) {
        case 0: while(input(ECHO_BIN1) && ++timeout_counter < 30000); break;
        case 1: while(input(ECHO_BIN2) && ++timeout_counter < 30000); break;
        case 2: while(input(ECHO_BIN3) && ++timeout_counter < 30000); break;
        case 3: while(input(ECHO_BIN4) && ++timeout_counter < 30000); break;
    }
    
    time_count = get_timer1();
    setup_timer_1(T1_DISABLED);
    
    if (timeout_counter >= 30000) return 0xFFFF; 
    
    uint32_t raw_dist = ((uint32_t)time_count * 343) / 2000;
    if (raw_dist > MAX_DISTANCE_MM) return MAX_DISTANCE_MM; 
    
    return (uint16_t)raw_dist;
}

void read_all_ultrasonic(void) {
    uint8_t i;
    for (i = 0; i < 4; i++) {
        uint16_t dist = read_single_ultrasonic(i);
        if (dist == 0xFFFF) {
            bin_status_flags[i] |= 0x01; 
            bin_distance_mm[i] = 0;
        } else {
            bin_status_flags[i] &= ~0x01; 
            bin_distance_mm[i] = dist;
        }
        delay_ms(15); 
    }
}

// =========================================================================
// 4. HX711 LOAD CELL DRIVER
// =========================================================================
void read_all_load_cells(void) {
    uint32_t raw_val[4] = {0, 0, 0, 0};
    uint8_t i, j;
    uint32_t timeout_counter = 0;
    
    while ((input(HX711_DT_BIN1) || input(HX711_DT_BIN2) || 
            input(HX711_DT_BIN3) || input(HX711_DT_BIN4)) && ++timeout_counter < 250000) {
        delay_us(1);
    }
    
    if (timeout_counter >= 250000) {
        for (i = 0; i < 4; i++) {
            bin_status_flags[i] |= 0x01; 
            bin_weight_g[i] = 0;
        }
        return;
    }
    
    for (i = 0; i < 24; i++) {
        output_high(HX711_SCK);
        delay_us(1); 
        for (j = 0; j < 4; j++) raw_val[j] = raw_val[j] << 1;
        output_low(HX711_SCK);
        delay_us(1);
        
        if (input(HX711_DT_BIN1)) raw_val[0] |= 1;
        if (input(HX711_DT_BIN2)) raw_val[1] |= 1;
        if (input(HX711_DT_BIN3)) raw_val[2] |= 1;
        if (input(HX711_DT_BIN4)) raw_val[3] |= 1;
    }
    
    output_high(HX711_SCK); delay_us(1); output_low(HX711_SCK); delay_us(1);
    
    for (i = 0; i < 4; i++) {
        int32_t val = raw_val[i];
        if (val & 0x800000) val |= 0xFF000000; 
        
        float weight = ((float)(val - HX711_OFFSET)) / HX711_SCALE;
        if (weight < 0) weight = 0; 
        
        if (weight > MAX_WEIGHT_G) {
            bin_weight_g[i] = MAX_WEIGHT_G;
            bin_status_flags[i] |= 0x01; 
        } else {
            bin_weight_g[i] = (uint16_t)weight;
            bin_status_flags[i] &= ~0x01; 
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
        servo_open_timer[bin_index] = SERVO_OPEN_DURATION_MS; 
    } else {
        servo_target_ticks[bin_index] = SERVO_CLOSED_TICKS;
        servo_state[bin_index] = 0;
        servo_open_timer[bin_index] = 0;
    }
}

void check_auto_close_timers(void) {
    uint8_t i;
    for (i = 0; i < 4; i++) {
        if (servo_state[i] && servo_open_timer[i] > 0) {
            if (servo_open_timer[i] > 370) { 
                servo_open_timer[i] -= 370; // Adjusted for total step delay
            } else {
                set_lid_state(i, 0); 
            }
        }
    }
}

// =========================================================================
// 6. UART PROTOCOL LAYER (COMMUNICATION WITH ESP32)
// =========================================================================
void send_telemetry_packet(uint8_t bin_index) {
    uint8_t packet[9];
    uint8_t i;
    
    packet[0] = PACKET_SOF;
    packet[1] = 0x09; 
    packet[2] = bin_index;
    packet[3] = (uint8_t)(bin_distance_mm[bin_index] >> 8);   
    packet[4] = (uint8_t)(bin_distance_mm[bin_index] & 0xFF);  
    packet[5] = (uint8_t)(bin_weight_g[bin_index] >> 8);       
    packet[6] = (uint8_t)(bin_weight_g[bin_index] & 0xFF);      
    packet[7] = bin_status_flags[bin_index];
    packet[8] = (uint8_t)servo_state[bin_index];
    
    uint8_t chk = compute_checksum(packet, 9);
    
    for (i = 0; i < 9; i++) {
        fputc(packet[i], HOST_ESP32);
    }
    fputc(chk, HOST_ESP32); 
}

uint8_t compute_checksum(uint8_t *packet, uint8_t len) {
    uint8_t result = 0;
    uint8_t i;
    for (i = 0; i < len; i++) {
        result ^= packet[i];
    }
    return result;
}

void process_incoming_uart(void) {
    while (kbhit(HOST_ESP32)) {
        uint8_t c = fgetc(HOST_ESP32);
        
        if (rx_index == 0) {
            if (c == PACKET_SOF) rx_buffer[rx_index++] = c;
        } 
        else if (rx_index == 1) {
            if (c > 0 && c < RX_BUFFER_LEN) rx_buffer[rx_index++] = c;
            else rx_index = 0; 
        } 
        else {
            rx_buffer[rx_index++] = c;
            uint8_t expected_total_len = rx_buffer[1]; 
            
            if (rx_index >= expected_total_len) {
                uint8_t received_chk = rx_buffer[expected_total_len - 1];
                uint8_t computed_chk = compute_checksum(rx_buffer, expected_total_len - 1);
                
                if (received_chk == computed_chk) {
                    uint8_t command = rx_buffer[2];
                    uint8_t target_bin = rx_buffer[3];
                    
                    if (command == CMD_OPEN_LID && target_bin < 4) {
                        set_lid_state(target_bin, 1); 
                    }
                }
                rx_index = 0; 
            }
        }
    }
}

// =========================================================================
// 7. MAIN PROGRAM SYSTEM LOOP
// =========================================================================
void main(void) {
    delay_ms(500); 
    init_hardware();
    
    while(TRUE) {
        read_all_ultrasonic();
        read_all_load_cells();
        process_incoming_uart();
        check_auto_close_timers();
        
        // FIXED: Stream packets with interleaving delays to protect 2400 baud limits
        uint8_t i;
        for (i = 0; i < 4; i++) {
            send_telemetry_packet(i);
            delay_ms(30); // Inter-packet structural buffer spacing
        }
        
        delay_ms(250); 
    }
}
