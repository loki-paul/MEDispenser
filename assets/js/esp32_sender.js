// =====================================
// ESP32 SENDER MODULE
// =====================================

// ESP32 local IP
const ESP32_IP = "http://192.168.1.175"; // Updated to match your ESP32
const ESP32_URL = `${ESP32_IP}/updateSchedules`;

/**
 * Send schedules array to ESP32
 * @param {Array} schedules - Array of schedule objects
 * Each object should look like:
 * { container: 1, days: ["Monday","Tuesday"], times: ["08:00","20:00"] }
 */
export function sendSchedulesToESP32(schedules) {
    if (!schedules || !Array.isArray(schedules) || schedules.length === 0) {
        console.warn("No schedules to send to ESP32.");
        return;
    }

    console.log("Sending schedules to ESP32:", schedules);

    fetch(ESP32_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ schedules }) // matches ESP32 expected format
    })
    .then(res => res.text())
    .then(reply => {
        console.log("ESP32 replied:", reply);
    })
    .catch(err => {
        console.error("Error sending schedules:", err);
    });
}

/**
 * Optional helper: send schedules automatically whenever Firebase updates
 * @param {Array} schedulesData - your schedules array
 */
export function autoSendSchedules(schedulesData) {
    if (!schedulesData || !Array.isArray(schedulesData)) return;
    sendSchedulesToESP32(schedulesData);
}

