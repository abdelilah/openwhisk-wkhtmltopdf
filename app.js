let os = require('os');
let path = require('path');
let fs = require('fs');
let exec = require('child_process').exec;
let express = require('express');
let app = express();
let bodyParser = require('body-parser');
let Observable = require('rxjs').Observable
let _ = require('lodash')

app.use(bodyParser.json());

let WKHTMLTOPDF = process.env.WKHTMLTOPDF || path.resolve('./wkhtmltox/bin/wkhtmltopdf')
 
app.post('/init', function (req, res) {
   res.status(200).send();       
});
 


app.post('/run', function(req, res){
    let basePath = os.tmpdir()
    let content = _.get(req.body, 'value.content', '')
    let header = _.get(req.body, 'value.header', null)
    let footer = _.get(req.body, 'value.footer', null)
    let options = _.get(req.body, 'value.options', '')

    let pathPDF = `${basePath}/result.pdf`
    let pathContent = `${basePath}/content.html`
    let pathHeader = `${basePath}/header.html`
    let pathFooter = `${basePath}/footer.html`

    let pdfOptions = [options]
    let todo = []

    // Write files
    todo.push(
        new Promise((resolve, reject) => {
            fs.writeFile(pathContent, content, resolve)
        })
    )

    if(header){
        pdfOptions.push('--header-html ' + pathHeader)
        todo.push(
            new Promise((resolve, reject) => {
                fs.writeFile(pathHeader, header, resolve)
            })
        )
    }

    if(footer){
        pdfOptions.push('--footer-html ' + pathFooter)
        todo.push(
            new Promise((resolve, reject) => {
                fs.writeFile(pathFooter, footer, resolve)
            })
        )
    }

    let pdfCommand = `${WKHTMLTOPDF} ${_.trim(pdfOptions.join(' '))} ${pathContent} ${pathPDF}`
    todo.push(
        new Promise(resolve => {
            exec(pdfCommand, (err, stdout, stderr) => {
                resolve()
            })
        })
    )

    

    // Generate PDF
    Observable
        .concat(...todo)
        .reduce((acc, cur) => [...acc, cur], [])
        .subscribe(
            result => {
                res.json({
                    pdf: new Buffer(fs.readFileSync(pathPDF)).toString('base64')
                })
            }, //res.sendFile(pathPDF),
            error => {
                console.error(error)
                res.status(500).json({
                    error: 'Failed to generate PDF',
                    // stack: error
                })
            }
        )
})
 
app.listen(8080, function () {
    console.log('Server started')
})