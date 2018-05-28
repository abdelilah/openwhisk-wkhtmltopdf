let os = require('os');
let path = require('path');
let fs = require('fs');
let exec = require('child_process').exec;
let express = require('express');
let app = express();
let bodyParser = require('body-parser');
let Observable = require('rxjs').Observable
let _ = require('lodash')

app.use(bodyParser.json({limit: 10000000}));

let WKHTMLTOPDF = process.env.WKHTMLTOPDF || path.resolve('/bin/wkhtmltopdf')


const runCommand = (command) => new Promise((resolve, reject) => {
    console.log("Running command", command);
    exec(command, (error, stdout, stderr) => {
        if(error !== null){
            console.error('Command failed: ' + command)
            console.log(error)
            console.log(stdout)
            console.log(stderr)
        }

        console.log("Command output", stdout);

        resolve(stdout)
    })
}) 

 
app.post('/init', function (req, res) {
   res.status(200).send();       
});
 


app.post('/run', function(req, res){

    let basePath = os.tmpdir()
    let content = _.get(req.body, 'value.content', '')
    let header = _.get(req.body, 'value.header', null)
    let footer = _.get(req.body, 'value.footer', null)
    let background = _.get(req.body, 'value.background', null)
    let options = _.get(req.body, 'value.options', '')

    let pathPDF = `${basePath}/result.pdf`
    let pathContent = `${basePath}/content.html`
    let pathHeader = `${basePath}/header.html`
    let pathFooter = `${basePath}/footer.html`
    let pathBackgroundImg = `${basePath}/bg.jpg`
    let pathBackgroundPdf = `${basePath}/bg.pdf`
    let pathBackgroundPdfMerged = `${basePath}/bg-mrged.pdf`

    let pdfOptions = [options]
    let todo = []

    // Write files
    console.log('Content size', content.length)
    todo.push(
        new Promise((resolve, reject) => {
            fs.writeFile(pathContent, content, resolve)
        })
    )

    if(background){
        console.log('Background size', background.length)

        todo.push(
            new Promise((resolve, reject) => {
                fs.writeFile(pathBackgroundImg, Buffer.from(background, 'base64'), resolve)
            })
        )

        todo.push(
            runCommand(`convert ${pathBackgroundImg} -page A4 ${pathBackgroundPdf}`)
        )
    }

    if(header){
        console.log('Header size', header.length)

        pdfOptions.push('--header-html ' + pathHeader)
        todo.push(
            new Promise((resolve, reject) => {
                fs.writeFile(pathHeader, header, resolve)
            })
        )
    }

    if(footer){
        console.log('Footer size', footer.length)

        pdfOptions.push('--footer-html ' + pathFooter)
        todo.push(
            new Promise((resolve, reject) => {
                fs.writeFile(pathFooter, footer, resolve)
            })
        )
    }

    todo.push(
        runCommand(`${WKHTMLTOPDF} ${_.trim(pdfOptions.join(' '))} ${pathContent} ${pathPDF}`)
    )


    

    // Generate PDF
    Observable
        .concat(...todo)
        .retryWhen((err) => {
            console.log('An error occured, retrying...', err);
            return err.delay(1000).take(3); // 3 times
        })
        .reduce((acc, cur) => [...acc, cur], [])
        .flatMap(r => background ? runCommand(`pdftk ${pathPDF} background ${pathBackgroundPdf} output ${pathBackgroundPdfMerged}`).then(r => pathPDF = pathBackgroundPdfMerged) : Observable.of(r))
        .subscribe(
            result => {
                res.header('Content-Type: application/pdf')
                // res.sendFile(pathPDF)
                res.json({
                    pdf: new Buffer(fs.readFileSync(pathPDF)).toString('base64')
                })
            },
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