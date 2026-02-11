# End-to-End System Verification & Fix Plan

## Objective
Ensure the "Voxora" application flow is seamless, resolving the issue where the microphone interaction fails or appears to "turn off" immediately after system checks. Verify that all technologies (LiveKit, WebSockets, Node.js Backend, Python Worker) are integrated correctly.

## Diagnosis
The user reported that the microphone "goes off" after the system check.
**Root Cause Identified:** The recent "Smart Start" implementation in `handleToggleMic` initiates a connection if one doesn't exist, but **fails to activate the microphone** after the connection is established. It effectively stops at "Connected" state (leaving the mic muted), which confuses the user.

## Implementation Steps

### 1. Fix "Smart Start" Logic (`client/src/App.jsx`)
- **Modify `handleToggleMic`**:
    - If not connected:
        - Call `handleToggleConnect()` and wait for it to complete.
        - **NEW**: Check if connection was successful.
        - **NEW**: If successful, immediately call `agent.toggleMicrophone()` (or `direct.toggleRecording()`).
- **Add Visual Feedback**:
    - Introduce a `isConnecting` state to show a spinner/loading indicator on the "Start" button while the connection is being established.

### 2. Verify Backend Connectivity
- **Status**: Validated. `http://localhost:8080/health` returns 200 OK.
- **Action**: No backend code changes needed. The logged `ECONNREFUSED` errors were from a previous state and have resolved.

### 3. Verify Worker Integration
- **Status**: `direct.py` is running and correctly imports `agent.py`.
- **Action**: Verify that the "Direct Mode" WebSocket and "Agent Mode" LiveKit worker are both active.

### 4. End-to-End Flow Validation
- **Agent Mode**:
    - User clicks "Start" -> System Check -> Connects to LiveKit -> **Mic Auto-Starts**.
    - Audio flows -> Worker Transcribes -> Text appears in feed.
- **Direct Mode**:
    - User clicks "Start" -> System Check -> Connects to WS -> **Recording Auto-Starts**.
    - Audio flows -> Local Whisper -> Text appears in feed.

## Task List
- [ ] Refactor `handleToggleMic` in `App.jsx` to chain connection and mic activation.
- [ ] Add `isConnecting` state to `SessionPage` for better UX.
- [ ] Verify Direct Mode logic parallels Agent Mode logic.
