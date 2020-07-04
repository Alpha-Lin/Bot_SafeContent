const Discord = require('discord.js')
const fs = require("fs")
const crypto = require('crypto')
const https = require('https');
const http = require('http')
const client = new Discord.Client();

const blacklist = JSON.parse(fs.readFileSync("blacklist_pictures.json"))

function urlify(url){//analyse toutes les URLs
    const res = []
    url.replace(/(https?:\/\/[^\s]+)/g, function(url){
        res.push(url)
    })
    return res
}

client.on('message', message => {
    if(blacklist["URL"].includes(...urlify(message.content))){//check 1 : URLs
        message.delete()
    }
    else{//check 2 : hash /*for..on*/
        if(message.attachments.size > 0 && message.attachments.size <= blacklist["max_size"]){//vérifie que la taille n'est pas supérieure à celle du plus gros fichier afin de ne pas le télécharger
            https.get(message.attachments.first().url, function(response) {//téléchargement du fichier
                response.pipe(crypto.createHash('whirlpool').setEncoding('hex')).on('finish', function () {//calcul du hash
                    if(blacklist["hash"].includes(this.read())){
                        if(!blacklist["URL"].includes(message.attachments.first().url)){//ajout de l'URL si elle n'est pas répertoriée
                            blacklist["URL"].push(message.attachments.first().url)
                            fs.writeFileSync('blacklist_pictures.json', JSON.stringify(blacklist))
                        }
                        message.delete()
                    }
                })
            });
        }
    }
});


function addToBlacklist(url, message, response){//ajout à la blacklist
    response.pipe(crypto.createHash('whirlpool').setEncoding('hex')).on('finish', function () {
        const hash = this.read()
        if(!blacklist['hash'].includes(hash))
            blacklist['hash'].push(hash)
        if(!blacklist['URL'].includes(url))
            blacklist['URL'].push(url)
        if(blacklist['max_size'] < response.headers['content-length'])
            blacklist['max_size'] = Number(response.headers['content-length'])
        message.delete()
        fs.writeFileSync('blacklist_pictures.json', JSON.stringify(blacklist))
    })
}

function downloadFile(url, message){//télécharge l'attachment
    const protocol = new URL(url)
    if(protocol.protocol === "https:"){//vérification des protocoles
        https.get(url, function(response){
            addToBlacklist(url, message, response);
        })
    }else if(protocol.protocol === "http:"){
        http.get(url, function(response){
            addToBlacklist(url, message, response);
        })
    }
}

client.on('messageReactionAdd', (reaction, user) => {
    if("260425539427368961" === user.id && reaction.emoji.name === "❌"){
        //ajout 1 : URLs
        urlify(reaction.message.content).forEach(url => {
            downloadFile(url, reaction.message)
        });
        //ajout 2 : hash et son URL
        if(reaction.message.attachments.size > 0){ 
            downloadFile(reaction.message.attachments.first().url, reaction.message)
        }
    }
});

client.login('')

//TODO : vérifier tous les attachments
