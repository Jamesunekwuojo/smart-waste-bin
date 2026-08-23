
#ifndef SETUP_H
#define SETUP_H

#include <16F876A.h>

#define uint8_t  int8
#define uint16_t int16
#define uint32_t int32
#define int32_t  signed int32
#define int1_t   int1
#use fast_io(a)
#use fast_io(b)
#use fast_io(c)

#fuses XT, NOWDT, PUT, BROWNOUT, NOLVP, NOCPD, NOWRT
#use delay(crystal=4000000)
#use rs232(baud=2400, xmit=PIN_C6, rcv=PIN_C7, stream=HOST_ESP32, errors)

#define ECHO_BIN1       PIN_B4
#define ECHO_BIN2       PIN_B5
#define ECHO_BIN3       PIN_B6
#define ECHO_BIN4       PIN_B7

#define TRIG_BIN1       PIN_B0
#define TRIG_BIN2       PIN_B1
#define TRIG_BIN3       PIN_B2
#define TRIG_BIN4       PIN_B3

#define HX711_SCK       PIN_C3
#define HX711_DT_BIN1   PIN_A0
#define HX711_DT_BIN2   PIN_A1
#define HX711_DT_BIN3   PIN_A2
#define HX711_DT_BIN4   PIN_A3

#define SERVO_BIN1      PIN_C1
#define SERVO_BIN2      PIN_C2
#define SERVO_BIN3      PIN_C4
#define SERVO_BIN4      PIN_C5

#define SERVO_CLOSED_TICKS  10   
#define SERVO_OPEN_TICKS    20   
#define SERVO_CYCLE_TICKS   200  

#define SERVO_OPEN_DURATION_MS 5000 
#define HX711_OFFSET    8388608  
#define HX711_SCALE     220.0    
#define MAX_DISTANCE_MM  1500     
#define MAX_WEIGHT_G     65000    

#define PACKET_SOF       0xAA     
#define CMD_OPEN_LID     0x01     

volatile uint8_t pwm_tick_count = 0;
volatile uint8_t servo_target_ticks[4] = {
    SERVO_CLOSED_TICKS, SERVO_CLOSED_TICKS, SERVO_CLOSED_TICKS, SERVO_CLOSED_TICKS
};

uint32_t servo_open_timer[4] = {0, 0, 0, 0};
int1_t servo_state[4] = {0, 0, 0, 0}; 

uint16_t bin_distance_mm[4] = {0, 0, 0, 0};
uint16_t bin_weight_g[4] = {0, 0, 0, 0};
uint8_t bin_status_flags[4] = {0, 0, 0, 0}; 

#define RX_BUFFER_LEN 16
uint8_t rx_buffer[RX_BUFFER_LEN];
uint8_t rx_index = 0;

void init_hardware(void);
void run_software_pwm_isr(void);
void read_all_ultrasonic(void);
uint16_t read_single_ultrasonic(uint8_t bin_index);
void read_all_load_cells(void);
void process_incoming_uart(void);
void send_telemetry_packet(uint8_t bin_index);
uint8_t compute_checksum(uint8_t *packet, uint8_t len);
void set_lid_state(uint8_t bin_index, int1_t open);
void check_auto_close_timers(void);

#endif // SETUP_H
