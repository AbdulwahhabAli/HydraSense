import React, { useState, useEffect } from 'react';
import './app.css';

function App() {
  const [device, setDevice] = useState(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [waterLevel, setWaterLevel] = useState(0);
  const [totalWater, setTotalWater] = useState(0);
  const [bottlesFinished, setBottlesFinished] = useState(0);
  const dailyGoal = 2500; // Daily goal in mL
  const serviceUUID = '00001234-0000-1000-8000-00805f9b34fb';
  const characteristicUUID = '00005678-0000-1000-8000-00805f9b34fb';
  const resetCharacteristicUUID = '00007654-0000-1000-8000-00805f9b34fb';

  const handleWaterLevelChange = (event) => {
    const data = event.target.value;
    const rawValue = new TextDecoder().decode(data).trim();
    console.log("🔵 Raw Bluetooth Data:", rawValue);

    const values = rawValue.split(" ");
    if (values.length !== 2) {
      console.error("❌ Invalid data format:", rawValue);
      return;
    }

    const newWaterLevel = parseInt(values[0], 10);
    const newTotalWater = parseInt(values[1], 10);

    if (isNaN(newWaterLevel) || isNaN(newTotalWater)) {
      console.error("❌ Invalid numbers received:", rawValue);
      return;
    }

    console.log(`✅ Parsed Water Level: ${newWaterLevel}%`);
    console.log(`✅ Parsed Total Water: ${newTotalWater} mL`);

    setWaterLevel(newWaterLevel);
    setTotalWater(newTotalWater);
    setBottlesFinished(Math.floor(newTotalWater / 500));
  };

  const connectToDevice = async () => {
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [serviceUUID] }]
      });

      console.log("📡 Device Selected:", device.name);

      const server = await device.gatt.connect();
      console.log("✅ Connected to GATT server");

      const service = await server.getPrimaryService(serviceUUID);
      const characteristic = await service.getCharacteristic(characteristicUUID);
      const resetCharacteristic = await service.getCharacteristic(resetCharacteristicUUID);

      setDevice(device);
      setConnected(true);

      const value = await characteristic.readValue();
      handleWaterLevelChange({ target: { value } });

      await characteristic.startNotifications();
      characteristic.addEventListener('characteristicvaluechanged', handleWaterLevelChange);

      setInterval(async () => {
        try {
          const updatedValue = await characteristic.readValue();
          handleWaterLevelChange({ target: { value: updatedValue } });
        } catch (err) {
          console.error("⚠️ Error reading value:", err);
        }
      }, 5000);

      window.resetDevice = async () => {
        try {
          console.log("⏳ Resetting device...");
          if (!resetCharacteristic) {
            throw new Error("Reset characteristic not available");
          }
          
          const resetCommand = new TextEncoder().encode("Reset");
          await resetCharacteristic.writeValueWithResponse(resetCommand);
          console.log("🔄 Reset command sent to device.");
        } catch (err) {
          console.error("❌ Reset failed:", err);
        }
      };

      setError(null);
    } catch (err) {
      console.error("❌ Connection failed", err);
      setError(`Failed to connect. Error: ${err.message}`);
    }
  };

  const disconnectDevice = async () => {
    if (device && device.gatt.connected) {
      await device.gatt.disconnect();
      setDevice(null);
      setConnected(false);
      setWaterLevel(0);
      setTotalWater(0);
      setBottlesFinished(0);
      setError(null);
      console.log("Device disconnected.");
    }
  };

  // Calculate percentage of daily goal
  const percentageGoalAchieved = (totalWater / dailyGoal) * 100;
  const waterLeft = dailyGoal - totalWater; // Calculate how much water is left to reach the goal

  return (
    <div className="App">
      <h1>HydraSense</h1>

      {connected ? (
        <>
          <p className="connected-text"><strong>Connected to:</strong> HydraSense</p>
          <h3>Current Water Level: {waterLevel}%</h3>
          <h3>Total Water Intake: {totalWater} mL</h3>
          <h3>Daily Goal: {dailyGoal} mL</h3>
          <h3>Bottles Finished: {bottlesFinished}</h3>
          <p>Total from Bottles: {bottlesFinished * 500} mL</p>

          <div className="progress-bar-container">
            <div
              className="progress-bar"
              style={{ width: `${percentageGoalAchieved}%` }}
            />
          </div>

          <p className="water-left">ML Left: {waterLeft} mL</p>

          <button onClick={window.resetDevice} style={{ marginRight: '10px' }}>Reset</button>
          <button onClick={disconnectDevice}>Disconnect</button>
        </>
      ) : (
        <button onClick={connectToDevice}>Connect to Device</button>
      )}

      {error && <p className="error">{error}</p>}
    </div>
  );
}

export default App;
