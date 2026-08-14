/*
 * setup.h
 * Configuration, Fuses, and Pin Assignments for PIC16F876A 4-Bin Controller.
 * Compiler: CCS C Compiler (PCWHD)
 */

#ifndef SETUP_H
#define SETUP_H

#include <16F876A.h>

// ==========================================
// 1. PIC16F876A FUSES (CONFIGURATION BITS)
// ==========================================
// XT: Crystal oscillator (Standard 4MHz external crystal)
// NOWDT: Disable Watchdog Timer (prototyping safety)
// PUT: Enable Power-up Timer (stabilizes voltage on boot)
// BROWNOUT: Enable Brown-out Reset (resets if voltage drops < 4.0V)
// NOLVP: Disable Low Voltage Programming (frees up RB3 pin for general I/O)
// NOCPD: Disable EEPROM write protection
// NOWRT: Disable Flash memory write protection
// NOCP: Disable code read protection
#fuses XT, NOWDT, PUT, BROWNOUT, NOLVP, NOCPD, NOWRT, NOCP

// Define crystal clock speed for delay routines (4MHz XT Crystal)
#use delay(crystal=4000000)

// ==========================================
// 2. HARDWARE UART SERIAL CONFIGURATION
// ==========================================
// Configures hardware serial port on pins RC6 (TX) and RC7 (RX).
// Baud rate set to 9600 for high stability across level-shifted connection to the ESP32.
#use rs232(baud=9600, xmit=PIN_C6, rcv=PIN_C7, stream=HOST_ESP32, errors)

// ==========================================
// 3. HARDWARE PIN ASSIGNMENTS
// ==========================================

// --- Ultrasonic Sensors (HC-SR04) ---
// Echos are connected to Port B (RB4-RB7) which support Interrupt-On-Change.
#define ECHO_BIN1       PIN_B4
#define ECHO_BIN2       PIN_B5
#define ECHO_BIN3       PIN_B6
#define ECHO_BIN4       PIN_B7

// Individual Trigger pins to prevent cross-talk between adjacent bins.
#define TRIG_BIN1       PIN_C0
#define TRIG_BIN2       PIN_B1
#define TRIG_BIN3       PIN_B2
#define TRIG_BIN4       PIN_B3

// --- Load Cells (HX711) ---
// All 4 modules share a single Clock line to save pins and synchronize reads.
#define HX711_SCK       PIN_C1

// Individual Data lines for reading the 24-bit readings in parallel.
#define HX711_DT_BIN1   PIN_A0
#define HX711_DT_BIN2   PIN_A1
#define HX711_DT_BIN3   PIN_A2
#define HX711_DT_BIN4   PIN_A3

// --- Servo Motors (SG90) ---
// Connected contiguously on Port C for fast masking in software PWM.
#define SERVO_BIN1      PIN_C2
#define SERVO_BIN2      PIN_C3
#define SERVO_BIN3      PIN_C4
#define SERVO_BIN4      PIN_C5

// ==========================================
// 4. CONSTANTS & SYSTEM PARAMETERS
// ==========================================

// Servo PWM values based on a 20ms period (50Hz) controlled by Timer0.
// Interrupt occurs every 100 microseconds (0.1ms).
// A 20ms period = 200 ticks of Timer0.
// Pulse width limits:
// - 1.0 ms (0 degrees) = 10 ticks of Timer0
// - 1.5 ms (90 degrees) = 15 ticks of Timer0
// - 2.0 ms (180 degrees) = 20 ticks of Timer0
#define SERVO_CLOSED_TICKS  10   // 1.0ms pulse (Lid Closed)
#define SERVO_OPEN_TICKS    20   // 2.0ms pulse (Lid Open)
#define SERVO_CYCLE_TICKS   200  // 20.0ms period (50Hz refresh rate)

// Servo auto-close delay parameters
#define SERVO_OPEN_DURATION_MS 5000 // Keep lid open for 5 seconds before auto-closing

// Load Cell Calibration Parameters (adjust these based on your calibration tests)
#define HX711_OFFSET    8388608  // Midpoint offset (24-bit ADC offset)
#define HX711_SCALE     220.0    // Scale factor to convert raw value to grams

// Anomaly limits
#define MAX_DISTANCE_MM  1500     // Bins are 1.5m tall
#define MAX_WEIGHT_G     65000    // Clamp weight readings at 65kg

// UART Packet Protocol
#define PACKET_SOF       0xAA     // Start-Of-Frame sync byte
#define CMD_OPEN_LID     0x01     // Command sent from ESP32 to open a specific lid

// ==========================================
// 5. GLOBAL VARIABLES
// ==========================================

// PWM counters and servo targets for all 4 bins
volatile uint8_t pwm_tick_count = 0;
volatile uint8_t servo_target_ticks[4] = {
    SERVO_CLOSED_TICKS, 
    SERVO_CLOSED_TICKS, 
    SERVO_CLOSED_TICKS, 
    SERVO_CLOSED_TICKS
};

// Auto-close timers for each servo lid (in milliseconds)
uint32_t servo_open_timer[4] = {0, 0, 0, 0};
int1_t servo_state[4] = {0, 0, 0, 0}; // 0 = Closed, 1 = Open

// Telemetry registers for all 4 bins
uint16_t bin_distance_mm[4] = {0, 0, 0, 0};
uint16_t bin_weight_g[4] = {0, 0, 0, 0};
uint8_t bin_status_flags[4] = {0, 0, 0, 0}; // Bit 0: Sensor Fault, Bit 1: Communication Err

// UART RX Buffer variables
#define RX_BUFFER_LEN 16
uint8_t rx_buffer[RX_BUFFER_LEN];
uint8_t rx_index = 0;

// ==========================================
// 6. FUNCTION PROTOTYPES
// ==========================================
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
