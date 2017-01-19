const path = require('path')
const config = require('../config.js')
const multer  = require('multer')
const randomstring = require('randomstring')
const db = require('knex')(config.database)
//const crypto = require('crypto')
//const fs = require('fs')

let uploadsController = {}

const storage = multer.diskStorage({
	destination: function (req, file, cb) {
		cb(null, './' + config.uploads.folder + '/')
	},
	filename: function (req, file, cb) {
		cb(null, randomstring.generate(config.uploads.fileLength) + path.extname(file.originalname))
	}
})

const upload = multer({
	storage: storage,
	limits: { fileSize: config.uploads.maxSize }
}).array('files[]')

uploadsController.upload = function(req, res, next){

	if(config.private === true)
		if(req.headers.auth !== config.clientToken)
			return res.status(401).json({ success: false, description: 'not-authorized'})

	let album = req.params.albumid
	
	if(album !== undefined)
		if(req.headers.adminauth !== config.adminToken)
			return res.status(401).json({ success: false, description: 'not-authorized'})
	
	upload(req, res, function (err) {
		if (err) {
			console.error(err)
			return res.json({ 
				success: false,
				description: err
			})
		}

		if(req.files.length === 0) return res.json({ success: false, description: 'no-files' })

		let files = []
		//let existingFiles = []

		req.files.forEach(function(file) {

			/*
			// Check if the file exists by checking hash and size
			let hash = crypto.createHash('md5')
			let stream = fs.createReadStream('./' + config.uploads.folder + '/' + file.filename)

			stream.on('data', function (data) {
				hash.update(data, 'utf8')
			})

			stream.on('end', function () {
				let fileHash = hash.digest('hex') // 34f7a3113803f8ed3b8fd7ce5656ebec

			})*/

			files.push({
				name: file.filename, 
				original: file.originalname,
				type: file.mimetype,
				size: file.size, 
				ip: req.ip,
				albumid: album,
				timestamp: Math.floor(Date.now() / 1000)
			})
		})

		db.table('files').insert(files).then(() => {
			
			let basedomain = req.get('host')
			for(let domain of config.domains)
				if(domain.host === req.get('host'))
					if(domain.hasOwnProperty('resolve'))
						basedomain = domain.resolve

			res.json({
				success: true,
				files: files.map(file => {
					return {
						name: file.name,
						size: file.size,
						url: 'http://' + basedomain + '/' + file.name
					}
				})
			})

		})
	})

}

uploadsController.list = function(req, res){

	if(req.headers.auth !== config.adminToken)
		return res.status(401).json({ success: false, description: 'not-authorized'})

	db.table('files')
	.where(function(){
		if(req.params.id === undefined)
			this.where('id', '<>', '')
		else
			this.where('albumid', req.params.id)
	})
	.orderBy('id', 'DESC')
	.then((files) => {
		db.table('albums').then((albums) => {

			let basedomain = req.get('host')
			for(let domain of config.domains)
				if(domain.host === req.get('host'))
					if(domain.hasOwnProperty('resolve'))
						basedomain = domain.resolve

			for(let file of files){
				file.file = 'http://' + basedomain + '/' + file.name
				//file.file = config.basedomain + config.uploads.prefix + file.name
				file.date = new Date(file.timestamp * 1000)
				file.date = file.date.getFullYear() + '-' + (file.date.getMonth() + 1) + '-' + file.date.getDate() + ' ' + (file.date.getHours() < 10 ? '0' : '') + file.date.getHours() + ':' + (file.date.getMinutes() < 10 ? '0' : '') + file.date.getMinutes() + ':' + (file.date.getSeconds() < 10 ? '0' : '') + file.date.getSeconds()

				file.album = ''
				
				if(file.albumid !== undefined)
					for(let album of albums)
						if(file.albumid === album.id)
							file.album = album.name

			}

			return res.json({
				success: true,
				files
			})
		})

	})
}

module.exports = uploadsController