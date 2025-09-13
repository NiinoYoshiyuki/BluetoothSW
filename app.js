// ESP32のBLE情報
const serviceUuid = "1b24e5c4-a39c-4d46-92fb-3bbcb2f34a41";
const characteristicUuid = "9d18d524-2a6e-44ce-8724-445575b23e9a";

// UI要素の取得
const connectButton = document.getElementById('connect-button');
const statusDiv = document.getElementById('status');
const displayTimeSpan = document.getElementById('display-time');
const startButton = document.getElementById('start-button');
const stopButton = document.getElementById('stop-button');
const resetButton = document.getElementById('reset-button');
const lapListUl = document.getElementById('lap-list');

let device;
let characteristic;
let startTime = 0;
let isRunning = false;
let lapCounter = 0;
let animationFrameId;

// Bluetooth接続関数
async function connectToDevice() {
    try {
        console.log("デバイスをスキャン中...");
        statusDiv.textContent = "接続中...";
        statusDiv.style.color = '#f39c12';
        
        // サービスUUIDでフィルタリングして、目的のデバイスのみをリストに表示
        device = await navigator.bluetooth.requestDevice({
            filters: [{ services: [serviceUuid] }]
        });
        
        console.log('GATTサーバーに接続を試行中...');
        const server = await device.gatt.connect();
        
        console.log('サービスを取得中...');
        const service = await server.getPrimaryService(serviceUuid);
        
        console.log('GATTサーバー接続成功、サービス取得成功');
        characteristic = await service.getCharacteristic(characteristicUuid);
        
        await characteristic.startNotifications();
        characteristic.addEventListener('characteristicvaluechanged', handleNotifications);
        
        statusDiv.textContent = "接続済み ✅";
        statusDiv.style.color = '#27ae60';
        connectButton.textContent = "切断";
        connectButton.onclick = disconnectFromDevice;
        
        device.addEventListener('gattserverdisconnected', onDisconnected);
        console.log("ESP32に接続しました。");

    } catch (error) {
        console.error("接続エラー:", error);
        statusDiv.textContent = "接続に失敗しました ❌";
        statusDiv.style.color = '#e74c3c';
        connectButton.textContent = "再接続";
    }
}

// 接続切断時の処理
function onDisconnected() {
    statusDiv.textContent = "切断されました";
    statusDiv.style.color = '#e74c3c';
    connectButton.textContent = "接続";
    connectButton.onclick = connectToDevice;
    resetStopwatchUI();
    console.log("ESP32との接続が切れました。");
}

// ストップウォッチのUIをリセット
function resetStopwatchUI() {
    isRunning = false;
    startTime = 0;
    lapCounter = 0;
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
    displayTimeSpan.textContent = '00:00.000';
    lapListUl.innerHTML = '';
}

// ESP32からの通知を処理
function handleNotifications(event) {
    const value = new TextDecoder().decode(event.target.value);
    
    try {
        const data = JSON.parse(value);
        console.log("Received data:", data);

        switch (data.event) {
            case 1: // 開始
                startTime = Date.now() - data.time_ms;
                isRunning = true;
                displayTime();
                console.log("ストップウォッチ開始");
                break;
            case 2: // ラップ1
                addLap('LAP 1', data.time_ms);
                console.log("ラップ1記録");
                break;
            case 3: // ラップ2
                addLap('LAP 2', data.time_ms);
                console.log("ラップ2記録");
                break;
            case 4: // ゴール
                addLap('GOAL', data.time_ms);
                isRunning = false;
                console.log("ゴール");
                break;
            case 5: // 停止
                isRunning = false;
                if (animationFrameId) {
                    cancelAnimationFrame(animationFrameId);
                }
                displayTimeSpan.textContent = formatTime(data.time_ms);
                console.log("ストップウォッチ停止");
                break;
            case 6: // リセット
                resetStopwatchUI();
                console.log("ストップウォッチリセット");
                break;
            default:
                break;
        }

    } catch (e) {
        console.error("JSONデータのパースに失敗しました:", e);
    }
}

// ラップタイムを追加
function addLap(label, time) {
    lapCounter++;
    const formattedTime = formatTime(time);
    const lapItem = document.createElement('li');
    lapItem.textContent = `${lapCounter}. ${label}: ${formattedTime}`;
    lapListUl.appendChild(lapItem);
}

// 時間表示を更新
function displayTime() {
    if (isRunning) {
        const currentTime = Date.now() - startTime;
        displayTimeSpan.textContent = formatTime(currentTime);
        animationFrameId = requestAnimationFrame(displayTime);
    }
}

// 時間をhh:mm:ss.sss形式にフォーマット
function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = ms % 1000;
    
    const formattedMinutes = String(minutes).padStart(2, '0');
    const formattedSeconds = String(seconds).padStart(2, '0');
    const formattedMilliseconds = String(milliseconds).padStart(3, '0');
    
    return `${formattedMinutes}:${formattedSeconds}.${formattedMilliseconds}`;
}

// Bluetoothにデータを書き込む関数
async function writeToCharacteristic(command) {
    if (!characteristic) {
        alert("Bluetoothデバイスに接続されていません。");
        return;
    }
    try {
        const encoder = new TextEncoder();
        const data = encoder.encode(command);
        await characteristic.writeValue(data);
        console.log(`コマンド '${command}' を送信しました。`);
    } catch (error) {
        console.error("書き込みエラー:", error);
    }
}

// イベントリスナーの設定
connectButton.addEventListener('click', connectToDevice);
startButton.addEventListener('click', () => writeToCharacteristic("start"));
stopButton.addEventListener('click', () => writeToCharacteristic("stop"));
resetButton.addEventListener('click', () => writeToCharacteristic("reset"));
