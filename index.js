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

client.on('ready', () => {
    for(guild of client.guilds.cache){ //vérifie que pour chaque serveur où le bot est présent, une entrée lui est associée
        if(blacklist[guild[0]] === undefined)
            blacklist[guild[0]] = {"URL":[],"hash":[],"max_size":0}
    }
})

client.on('message', message => {
    const serverID = message.guild.id

    if(blacklist[serverID]["URL"].includes(...urlify(message.content))){//check 1 : URLs
        message.delete()
    }
    else{//check 2 : hash /*for..on*/
        if(message.attachments.size > 0 && message.attachments.size <= blacklist[serverID]["max_size"]){//vérifie que la taille n'est pas supérieure à celle du plus gros fichier afin de ne pas le télécharger
            https.get(message.attachments.first().url, function(response) {//téléchargement du fichier
                response.pipe(crypto.createHash('whirlpool').setEncoding('hex')).on('finish', function () {//calcul du hash
                    if(blacklist[serverID]["hash"].includes(this.read())){
                        if(!blacklist[serverID]["URL"].includes(message.attachments.first().url)){//ajout de l'URL si elle n'est pas répertoriée
                            blacklist[serverID]["URL"].push(message.attachments.first().url)
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
        if(!blacklist[message.guild.id]['hash'].includes(hash))
            blacklist[message.guild.id]['hash'].push(hash)
        if(!blacklist[message.guild.id]['URL'].includes(url))
            blacklist[message.guild.id]['URL'].push(url)
        if(blacklist[message.guild.id]['max_size'] < response.headers['content-length'])
            blacklist[message.guild.id]['max_size'] = Number(response.headers['content-length'])
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

client.on('messageReactionAdd', reaction => {
    if(reaction.message.member.hasPermission("MANAGE_MESSAGES") && reaction.emoji.name === "❌"){
        //ajout 1 : URLs
        for(url of urlify(reaction.message.content)){
            downloadFile(url, reaction.message)
        };
        //ajout 2 : hash et son URL
        if(reaction.message.attachments.size > 0){ 
            downloadFile(reaction.message.attachments.first().url, reaction.message)
        }
    }
});

client.login('')

//TODO : vérifier tous les attachments
