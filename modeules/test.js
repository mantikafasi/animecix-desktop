var jwp = jwplayer("vidd");
jwp.on('time', function (e) {
    ipcRenderer.send("updateRPC", {duration:Math.floor(jwp.duration),position:Math.floor(e.position)});});

    jwp.once('play', function () {
        var title = document.getElementsByClassName("title")[0].innerText;
        ipcRenderer.send("updateRPC", {duration:Math.floor(jwp.duration),position:Math.floor(e.position),
        title:title,state:true});
    });


    jwp.once('pause', function () {
        var title = document.getElementsByClassName("title")[0].innerText;
        ipcRenderer.send("updateRPC", {duration:Math.floor(jwp.duration),position:Math.floor(e.position),
        title:title,state:false});
    });
