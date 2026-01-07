const pngToIco = require('png-to-ico').default || require('png-to-ico');
const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, 'src/assets/Thoughts+.png');
const outputPath = path.join(__dirname, 'src/assets/ThoughtsPlus.ico');

pngToIco(inputPath)
    .then(buf => {
        fs.writeFileSync(outputPath, buf);
        console.log('✅ Successfully created ThoughtsPlus.ico');
        
        // Also copy to public folder
        const publicOutputPath = path.join(__dirname, 'public/ThoughtsPlus.ico');
        fs.writeFileSync(publicOutputPath, buf);
        console.log('✅ Also copied to public/ThoughtsPlus.ico');
    })
    .catch(err => {
        console.error('❌ Error converting PNG to ICO:', err);
        process.exit(1);
    });
