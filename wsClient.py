import socketio


sio = socketio.Client()
sio.connect('http://localhost:80')

sio.emit("test", {"data": "test"})