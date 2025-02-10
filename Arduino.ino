#include <ArduinoBLE.h>

// Define analog pins for water level detection
const int analogA0 = A0;
const int analogA1 = A1;
const int analogA3 = A3;
const int analogA4 = A4;

int level_1, level_2, level_3, level_4;
int threshold = 80;

// Variables to track water level and intake
int currentWaterLevel = 0;  // Real-time water level
int storedWaterLevel = 0;   // Stored water level updated every 5 seconds
int totalWaterIntake = 0;   // Total water intake (mL)
int bottlesFinished = 0;    // Number of bottles finished

unsigned long lastStoredUpdateTime = 0;
unsigned long storedUpdateInterval = 5000;  // 5 seconds update interval

// BLE UUIDs for service and characteristics
BLEService waterLevelService("00001234-0000-1000-8000-00805f9b34fb");  
BLEStringCharacteristic levelCharacteristic("00005678-0000-1000-8000-00805f9b34fb", BLERead | BLENotify, 10);
BLEStringCharacteristic resetCharacteristic("00007654-0000-1000-8000-00805f9b34fb", BLEWrite, 6);  // 🔹 Increased to 6

void setup() {
    Serial.begin(115200);
    while (!Serial);

    // Initialize BLE
    if (!BLE.begin()) {
        Serial.println("❌ Failed to initialize BLE!");
        while (1);
    }

    BLE.setLocalName("HydraSense");
    BLE.setAdvertisedService(waterLevelService);
    waterLevelService.addCharacteristic(levelCharacteristic);
    waterLevelService.addCharacteristic(resetCharacteristic);
    BLE.addService(waterLevelService);
    
    levelCharacteristic.writeValue("0 0");
    resetCharacteristic.writeValue("No reset");

    BLE.advertise();
    Serial.println("✅ BLE Ready. Waiting for connection...");
}

void loop() {
    BLEDevice central = BLE.central();

    if (central) {
        Serial.print("🔗 Connected to: ");
        Serial.println(central.address());

        while (central.connected()) {
            // Check for reset command
            if (resetCharacteristic.written()) {
                String resetCommand = resetCharacteristic.value();
                resetCommand.trim();  // 🔹 Ensure no leading/trailing spaces

                Serial.print("📥 Received Reset Command: ");
                Serial.println(resetCommand);

                // Debugging - Print ASCII values of received string
                Serial.print("📥 ASCII Values: ");
                for (int i = 0; i < resetCommand.length(); i++) {
                    Serial.print((int)resetCommand[i]);
                    Serial.print(" ");
                }
                Serial.println();

                if (resetCommand.equals("Reset")) {  
                    Serial.println("🔄 Resetting water data...");
                    resetWaterData();

                    resetCharacteristic.writeValue("");  // 🔹 Clear old value
                    delay(100);  // 🔹 Small delay to ensure proper write
                    resetCharacteristic.writeValue("OK");  // Send confirmation
                }
            }

            // Read sensor values
            level_1 = analogRead(analogA0);
            level_2 = analogRead(analogA1);
            level_3 = analogRead(analogA3);
            level_4 = analogRead(analogA4);

            // Determine water level percentage
            int water_level = (level_1 > threshold) + (level_2 > threshold) + (level_3 > threshold) + (level_4 > threshold);
            currentWaterLevel = water_level * 25;  // Convert to percentage (0, 25, 50, 75, 100%)

            // Update stored water level periodically
            if (millis() - lastStoredUpdateTime >= storedUpdateInterval) {
                if (currentWaterLevel < storedWaterLevel) {
                    int waterDrunk = (storedWaterLevel - currentWaterLevel) * 125 / 25;
                    totalWaterIntake += waterDrunk;
                    bottlesFinished = totalWaterIntake / 500;
                }
                
                storedWaterLevel = currentWaterLevel;
                lastStoredUpdateTime = millis();
                
                // 🔹 Send updated values via BLE
                String bleData = String(currentWaterLevel) + " " + String(totalWaterIntake);
                levelCharacteristic.writeValue(bleData);
                Serial.print("📤 Sent Data: ");
                Serial.println(bleData);
            }

            delay(1000);
        }
        Serial.println("🔌 Disconnected.");
    }
}

void resetWaterData() {
    currentWaterLevel = 0;
    storedWaterLevel = 0;
    totalWaterIntake = 0;
    bottlesFinished = 0;
    Serial.println("✅ Water data reset.");
}
