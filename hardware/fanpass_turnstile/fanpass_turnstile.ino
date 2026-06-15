#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <Servo.h>

// FanPass mock turnstile wiring:
// EP8280 TX/DATA OUT -> Arduino D0/RX1
// EP8280 RX/DATA IN  -> not connected for this first test
// EP8280 decode LED   -> D2 optional fallback
// Servo signal       -> D9
// Ultrasonic TRIG    -> D6
// Ultrasonic ECHO    -> D7
// LCD SDA/SCL        -> Arduino SDA/SCL

const int EP8280_DECODE_PIN = 2; // EP8280 8-pin Pin 7 / decode-success LED output
const int SERVO_PIN = 9;
const int ULTRASONIC_TRIG_PIN = 6;
const int ULTRASONIC_ECHO_PIN = 7;
const int WIEGAND_D0_PIN = 3; // EP8280 Pin 4 / WG_DATA0
const int WIEGAND_D1_PIN = 4; // EP8280 Pin 3 / WG_DATA1

const int SERVO_CLOSED_ANGLE = 0;
const int SERVO_OPEN_ANGLE = 85;

const unsigned long GATE_OPEN_TIMEOUT_MS = 4000;
const unsigned long SENSOR_CONFIRM_MS = 350;
const unsigned long HEARTBEAT_INTERVAL_MS = 15000;
const unsigned long DISTANCE_LOG_INTERVAL_MS = 500;
const unsigned long DECODE_FALLBACK_DELAY_MS = 450;
const unsigned long SCAN_COOLDOWN_MS = 1200;
const unsigned long SENSOR_ARM_DELAY_MS = 2000;
const unsigned long WIEGAND_PROBE_INTERVAL_MS = 300;
const int PASS_DISTANCE_CM = 5;

// Gate policy for the bench prototype:
// Any QR payload received over TTL or Wiegand opens the gate. The EP8280 decode
// pin fallback proves the scanner saw a code/card but does not contain payload
// text. It opens the gate in this bench demo only.
const char REQUIRED_QR_MARKER[] = "FANPASS";
const bool ALLOW_ANY_QR_FOR_TESTING = true;
const bool ALLOW_DECODE_FALLBACK_OPEN = true;

Servo gateServo;
LiquidCrystal_I2C *lcd = nullptr;

String scanBuffer = "";
unsigned long lastScannerByteAt = 0;
unsigned long lastHeartbeatAt = 0;
int lastDecodePinState = HIGH;
unsigned long lastDecodePinChangeAt = 0;
bool decodeFallbackPending = false;
unsigned long decodeFallbackAt = 0;
unsigned long lastScanCompletedAt = 0;

volatile uint64_t wiegandValue = 0;
volatile byte wiegandBits = 0;
volatile unsigned long lastWiegandPulseAt = 0;
volatile unsigned long wiegandD0PulseCount = 0;
volatile unsigned long wiegandD1PulseCount = 0;
unsigned long lastWiegandHandledAt = 0;
unsigned long lastWiegandD0Reported = 0;
unsigned long lastWiegandD1Reported = 0;
unsigned long lastWiegandProbeAt = 0;

void setup() {
  pinMode(EP8280_DECODE_PIN, INPUT_PULLUP);
  pinMode(ULTRASONIC_TRIG_PIN, OUTPUT);
  pinMode(ULTRASONIC_ECHO_PIN, INPUT);
  pinMode(WIEGAND_D0_PIN, INPUT_PULLUP);
  pinMode(WIEGAND_D1_PIN, INPUT_PULLUP);
  digitalWrite(ULTRASONIC_TRIG_PIN, LOW);

  attachInterrupt(digitalPinToInterrupt(WIEGAND_D0_PIN), onWiegandD0, FALLING);
  attachInterrupt(digitalPinToInterrupt(WIEGAND_D1_PIN), onWiegandD1, FALLING);

  gateServo.attach(SERVO_PIN);
  closeGate();

  Serial.begin(115200);
  Serial1.begin(9600);

  Wire.begin();
  scanI2cBus();
  setupLcd();

  lastDecodePinState = digitalRead(EP8280_DECODE_PIN);
  showReady();
  Serial.println("FanPass turnstile ready. Waiting for EP8280 scan on Serial1 9600.");
}

void loop() {
  readScanner();
  readWiegand();
  reportWiegandProbe();
  readDecodeSignal();
  handleDecodeFallback();
  printHeartbeat();
}

void onWiegandD0() {
  wiegandD0PulseCount++;
  if (wiegandBits < 64) {
    wiegandValue <<= 1;
    wiegandBits++;
    lastWiegandPulseAt = millis();
  }
}

void onWiegandD1() {
  wiegandD1PulseCount++;
  if (wiegandBits < 64) {
    wiegandValue <<= 1;
    wiegandValue |= 1;
    wiegandBits++;
    lastWiegandPulseAt = millis();
  }
}

void reportWiegandProbe() {
  if (millis() - lastWiegandProbeAt < WIEGAND_PROBE_INTERVAL_MS) {
    return;
  }

  lastWiegandProbeAt = millis();

  unsigned long d0Count;
  unsigned long d1Count;
  byte bits;
  unsigned long pulseAt;

  noInterrupts();
  d0Count = wiegandD0PulseCount;
  d1Count = wiegandD1PulseCount;
  bits = wiegandBits;
  pulseAt = lastWiegandPulseAt;
  interrupts();

  if (d0Count == lastWiegandD0Reported && d1Count == lastWiegandD1Reported) {
    return;
  }

  lastWiegandD0Reported = d0Count;
  lastWiegandD1Reported = d1Count;

  Serial.print("WIEGAND PROBE d0=");
  Serial.print(d0Count);
  Serial.print(" d1=");
  Serial.print(d1Count);
  Serial.print(" bits=");
  Serial.print(bits);
  Serial.print(" idle_ms=");
  Serial.println(millis() - pulseAt);

  showLine("WG PULSE", "D0 " + String(d0Count) + " D1 " + String(d1Count));
}

void readWiegand() {
  byte bits;
  uint64_t value;
  unsigned long pulseAt;

  noInterrupts();
  bits = wiegandBits;
  value = wiegandValue;
  pulseAt = lastWiegandPulseAt;
  interrupts();

  if (bits == 0) {
    return;
  }

  // Wiegand packets are short bursts. A 35ms idle gap means one packet ended.
  if (millis() - pulseAt < 35 || pulseAt == lastWiegandHandledAt) {
    return;
  }

  noInterrupts();
  wiegandBits = 0;
  wiegandValue = 0;
  lastWiegandHandledAt = pulseAt;
  interrupts();

  String payload = "WG:";
  payload += String(bits);
  payload += ":";
  payload += uint64ToDecimal(value);

  Serial.print("WIEGAND bits=");
  Serial.print(bits);
  Serial.print(" value=");
  Serial.println(uint64ToDecimal(value));

  handleScan(payload);
}

void readScanner() {
  while (Serial1.available() > 0) {
    char c = (char)Serial1.read();
    lastScannerByteAt = millis();

    Serial.print("EP8280 BYTE 0x");
    if ((byte)c < 0x10) {
      Serial.print("0");
    }
    Serial.print((byte)c, HEX);
    Serial.print(" ");
    if (isPrintable(c)) {
      Serial.print("'");
      Serial.print(c);
      Serial.print("'");
    }
    Serial.println();

    if (c == '\r' || c == '\n') {
      if (scanBuffer.length() > 0) {
        decodeFallbackPending = false;
        handleScan(scanBuffer);
        scanBuffer = "";
      }
      continue;
    }

    if (scanBuffer.length() < 240) {
      scanBuffer += c;
    } else {
      scanBuffer = "";
      showLine("SCAN TOO LONG", "Buffer cleared");
      delay(1200);
      showReady();
    }
  }

  // Some scanner settings send no CR/LF terminator. Treat a short idle gap
  // after incoming bytes as the end of one scan.
  if (scanBuffer.length() > 0 && millis() - lastScannerByteAt > 180) {
    decodeFallbackPending = false;
    handleScan(scanBuffer);
    scanBuffer = "";
  }
}

void readDecodeSignal() {
  int state = digitalRead(EP8280_DECODE_PIN);
  if (state == lastDecodePinState) {
    return;
  }

  unsigned long now = millis();
  lastDecodePinState = state;

  // Ignore startup noise and switch bounce/noise around the indicator output.
  if (now < 700 || now - lastDecodePinChangeAt < 120) {
    return;
  }

  lastDecodePinChangeAt = now;
  Serial.print("EP8280 DECODE PIN changed to ");
  Serial.println(state);

  decodeFallbackPending = true;
  decodeFallbackAt = now;
}

void handleDecodeFallback() {
  if (!decodeFallbackPending) {
    return;
  }

  if (millis() - decodeFallbackAt < DECODE_FALLBACK_DELAY_MS) {
    return;
  }

  // If TTL bytes are arriving, let readScanner() finish the real QR payload.
  if (scanBuffer.length() > 0 || Serial1.available() > 0) {
    return;
  }

  if (millis() - lastScanCompletedAt < SCAN_COOLDOWN_MS) {
    decodeFallbackPending = false;
    Serial.println("EP8280 DECODE fallback ignored: recent scan already handled.");
    return;
  }

  decodeFallbackPending = false;
  Serial.println("EP8280 DECODE fallback used: no TTL payload received.");
  handleScan("EP8280:DECODE_PIN");
}

void handleScan(String payload) {
  payload.trim();
  if (payload.length() == 0) {
    return;
  }

  Serial.print("SCAN: ");
  Serial.println(payload);

  if (isDecodeFallbackPayload(payload)) {
    showLine("NFC/CARD SEEN", "Gate check");
  } else {
    showLine("VERIFYING PASS", shortText(payload));
  }
  delay(350);

  if (!isAuthorized(payload)) {
    if (isDecodeFallbackPayload(payload)) {
      showLine("NO SCAN DATA", "Scan again");
    } else {
      showLine("ACCESS DENIED", "Invalid pass");
    }
    Serial.println("DENIED");
    delay(1800);
    lastScanCompletedAt = millis();
    showReady();
    return;
  }

  Serial.println("ACCESS OK");
  showLine("PASS VALID", "Gate opening");
  delay(300);
  openGate();
  waitBeforeSensorArmed();
  showLine("GATE OPEN", "Watching 5cm");

  bool objectDetected = holdGateUntilClear();

  if (objectDetected) {
    showLine("CLEAR", "Gate closing");
    Serial.println("OBJECT_CLEARED");
  } else {
    showLine("NO OBJECT", "Gate closing");
    Serial.println("NO_OBJECT_TIMEOUT");
  }

  closeGate();
  delay(1000);
  lastScanCompletedAt = millis();
  showReady();
}

bool isAuthorized(String payload) {
  if (isDecodeFallbackPayload(payload)) {
    return ALLOW_DECODE_FALLBACK_OPEN;
  }

  if (ALLOW_ANY_QR_FOR_TESTING) {
    return true;
  }

  payload.toUpperCase();
  return payload.indexOf(REQUIRED_QR_MARKER) >= 0;
}

bool isDecodeFallbackPayload(String payload) {
  payload.trim();
  return payload == "EP8280:DECODE_PIN";
}

void waitBeforeSensorArmed() {
  unsigned long start = millis();
  int lastShownSecond = -1;

  while (millis() - start < SENSOR_ARM_DELAY_MS) {
    unsigned long remainingMs = SENSOR_ARM_DELAY_MS - (millis() - start);
    int remainingSeconds = (int)((remainingMs + 999) / 1000);

    if (remainingSeconds != lastShownSecond) {
      lastShownSecond = remainingSeconds;
      showLine("GATE OPEN", "Sensor in " + String(remainingSeconds));
    }

    delay(80);
  }
}

bool holdGateUntilClear() {
  unsigned long noObjectSince = millis();
  unsigned long firstDetectedAt = 0;
  unsigned long lastDistanceLogAt = 0;
  unsigned long lastLcdUpdateAt = 0;
  bool objectConfirmed = false;

  while (true) {
    int distance = readDistanceCm();

    if (millis() - lastDistanceLogAt >= DISTANCE_LOG_INTERVAL_MS) {
      lastDistanceLogAt = millis();
      Serial.print("DISTANCE_CM: ");
      Serial.println(distance);
    }

    if (distance > 0 && distance <= PASS_DISTANCE_CM) {
      if (firstDetectedAt == 0) {
        firstDetectedAt = millis();
      }
      if (millis() - firstDetectedAt >= SENSOR_CONFIRM_MS) {
        objectConfirmed = true;
        noObjectSince = millis();
        if (millis() - lastLcdUpdateAt >= 500) {
          lastLcdUpdateAt = millis();
          showLine("OBJECT 5CM", "Gate held open");
        }
      }
    } else {
      firstDetectedAt = 0;
      if (millis() - noObjectSince >= GATE_OPEN_TIMEOUT_MS) {
        return objectConfirmed;
      }
      if (millis() - lastLcdUpdateAt >= 500) {
        lastLcdUpdateAt = millis();
        unsigned long remainingMs = GATE_OPEN_TIMEOUT_MS - (millis() - noObjectSince);
        int remainingSeconds = (int)((remainingMs + 999) / 1000);
        showLine("NO OBJECT", "Closing in " + String(remainingSeconds));
      }
    }

    delay(80);
  }
}

int readDistanceCm() {
  digitalWrite(ULTRASONIC_TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(ULTRASONIC_TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(ULTRASONIC_TRIG_PIN, LOW);

  unsigned long duration = pulseIn(ULTRASONIC_ECHO_PIN, HIGH, 30000);
  if (duration == 0) {
    return -1;
  }

  return (int)(duration / 58);
}

void openGate() {
  gateServo.write(SERVO_OPEN_ANGLE);
}

void closeGate() {
  gateServo.write(SERVO_CLOSED_ANGLE);
}

void setupLcd() {
  byte addr = findI2cLcdAddress();
  if (addr == 0) {
    Serial.println("No I2C LCD found. Continuing with Serial output only.");
    Serial.println("Check LCD VCC/GND, SDA/SCL pins, backpack address, and contrast potentiometer.");
    return;
  }

  lcd = new LiquidCrystal_I2C(addr, 16, 2);
  lcd->init();
  lcd->backlight();

  Serial.print("I2C LCD found at 0x");
  Serial.println(addr, HEX);
  showLine("LCD ONLINE", "Addr 0x" + String(addr, HEX));
  delay(1200);
}

void printHeartbeat() {
  if (millis() - lastHeartbeatAt < HEARTBEAT_INTERVAL_MS) {
    return;
  }

  lastHeartbeatAt = millis();

  Serial.print("HEARTBEAT ms=");
  Serial.print(millis());
  Serial.print(" distance=");
  Serial.print(readDistanceCm());
  Serial.print("cm wgD0=");
  Serial.print(digitalRead(WIEGAND_D0_PIN));
  Serial.print(" wgD1=");
  Serial.print(digitalRead(WIEGAND_D1_PIN));
  Serial.print(" decode=");
  Serial.print(digitalRead(EP8280_DECODE_PIN));
  Serial.println(" waiting_for_scan=1");
}

byte findI2cLcdAddress() {
  byte common[] = {0x27, 0x3F};

  for (byte i = 0; i < sizeof(common); i++) {
    Wire.beginTransmission(common[i]);
    if (Wire.endTransmission() == 0) {
      return common[i];
    }
  }

  for (byte addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) {
      return addr;
    }
  }

  return 0;
}

void scanI2cBus() {
  int found = 0;

  Serial.println("Scanning I2C bus...");
  for (byte addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) {
      found++;
      Serial.print("I2C device found at 0x");
      if (addr < 0x10) {
        Serial.print("0");
      }
      Serial.println(addr, HEX);
    }
  }

  if (found == 0) {
    Serial.println("No I2C devices found.");
  }
}

void showReady() {
  showLine("FanPass Gate", "Scan QR/NFC");
}

void showLine(String line1, String line2) {
  line1 = fit16(line1);
  line2 = fit16(line2);

  Serial.print("LCD: ");
  Serial.print(line1);
  Serial.print(" | ");
  Serial.println(line2);

  if (!lcd) {
    return;
  }

  lcd->clear();
  lcd->setCursor(0, 0);
  lcd->print(line1);
  lcd->setCursor(0, 1);
  lcd->print(line2);
}

String shortText(String value) {
  value.trim();
  if (value.length() <= 16) {
    return value;
  }
  return value.substring(0, 13) + "...";
}

String fit16(String value) {
  if (value.length() > 16) {
    return value.substring(0, 16);
  }
  while (value.length() < 16) {
    value += " ";
  }
  return value;
}

String uint64ToDecimal(uint64_t value) {
  if (value == 0) {
    return "0";
  }

  char buffer[21];
  buffer[20] = '\0';
  int pos = 19;

  while (value > 0 && pos >= 0) {
    buffer[pos] = '0' + (value % 10);
    value /= 10;
    pos--;
  }

  return String(&buffer[pos + 1]);
}
