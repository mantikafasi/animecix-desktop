from flask import Flask, render_template
from flask_socketio import SocketIO


app = Flask(__name__)
sio = SocketIO(app)

@sio.on_event('connect')
def connect():
    print("connected")


@sio.event
def connect(sid, environ, auth):
    print('connect ', sid)

@sio.on('createRoom')
def createRoom(sid):
    sio.enter_room(sid, 'room1')

@sio.event
def disconnect(sid):
    print('disconnect ', sid)

@sio.on("test")
def fart(data):
    print("test")
    print(data)



if __name__ == '__main__':
    sio.run(app,host="0.0.0.0",port=80)


