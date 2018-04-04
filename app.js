const express = require('express');
const bodyParser = require('body-parser');

const rp = require('request-promise-native');
const request = rp.defaults();

process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
});

var app = express();

app.use(bodyParser.json());

app.post('/batch', async function(req, res){
    const result = await execBatch(req.body.endpoint, req.body.payloads);
    res.send(result);
});

async function execBatch(endpoint, payloads) {
    var i = 0;
    payloads.forEach(p => p.id = i++);
    
    var result = {
        stat: {
            success: 0,
            failed: 0
        }, 
        responses: []
    };

    await Promise.all(payloads.map(async (payload) => {   
        try {
            const response = await exec(endpoint, payload, true);
            result.stat.success++;
            result.responses[payload.id] = {
                "id": payload.id,
                "status": "success",
                "response": response
            };
        } catch (e) {
            result.stat.failed++;
            result.responses[payload.id] = {
                "id": payload.id,
                "status": "failed",
                "response": e.message
            };
        }
        
        return;
    }));

    return result;
}

async function exec(endpoint, payload, retry) {
    try {
        return await request({
            method: endpoint.verb,
            url: resolveUrl(endpoint.url, payload.path),
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json"
            },
            json: true,
            body: payload.body
        });
    } catch (e) {
        if (e.statusCode === 503 && retry) {
            return await exec(endpoint, payload, false);
            
        } else if (e.statusCode === 429) {
            await wait(5000);
            return await exec(endpoint, payload, true);
        } else {
            throw e;
        }
    }
}

function resolveUrl(url, paths) {
    if (paths) {
        for (let path of Object.keys(paths)) {
            url = url.replace('{' + path + '}', paths[path]);
        }
    }

    return url;
}

async function wait(timeout) {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve()
            }, timeout)
        })
}

app.listen(5000);