var express = require('express');
var fs = require('fs');
var app = express();

app.use(express.static(__dirname + '/www'));
app.use('/runs',express.static(__dirname + '/runs'));

app.get('/run_list.json',function(req,res) {
  fs.readdir('runs',function(err,files) {
    res.send(files);
  });
});

app.listen(3000);
