const express=require('express');
const fsp=require('fs').promises;
const fs=require('fs');
const path=require('path'); 
const database = require('better-sqlite3');

const db=new database('rag.db', { verbose: console.log });

const app=express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.get('/executedb', (req, res) => {

    try
    {
        db.exec(`
            Create table if not exists files(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                content TEXT,
                path TEXT,
                embedding TEXT
            )
        `);
        res.status(200).json({ message: 'Database executed successfully' });
    }
    catch (error) {
        console.error('Error creating table:', error);
        return res.status(500).json({ error: 'Failed to create table' });
    }
})

async function getEmbedding(text) {
    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text
    });
    return response.data[0].embedding;
  }

  async function indexFile(name, path, content) {
    const embedding = await getEmbedding(content);

    console.log('Embedding for', name, ':', embedding);

    db.prepare(`
      INSERT INTO files (name, path, content, embedding)
      VALUES (?, ?, ?, ?)
    `).run(name, path, content, JSON.stringify(embedding));
  }

app.get('/search', async (req, res) => {
    const  {name}  = req.query;
   

    if (!name) {
        return res.status(400).json({ error: 'Missing name parameter' });
    }

    try {
        const fileData = await fsp.readFile('index.json', 'utf8');
        const index = JSON.parse(fileData);


        // console.log(index);
        const filtered = index.filter(file =>
            file.name.toLowerCase().includes(name.toLowerCase()) || 
            file.content.toLowerCase().includes(name.toLowerCase()) ||
            file.extension.toLowerCase().includes(name.toLowerCase())
        );
       
        console.log(filtered.length);
        if(filtered.length===0){
            return res.status(404).json({ message: 'No files found' });
        }

        filtered.forEach(element => {
            console.log(element.name, element.extension);
        });
        // res.json(filtered);
    } catch (err) {
        console.error('Error in /search:', err);
        res.status(500).json({ error: 'Failed to search index' });
    }

})
const OpenAI = require('openai');
const openai = new OpenAI({apiKey:"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"});


app.get('/ask', async (req, res) => {
    const { query } = req.query;
    
    const response=await askAI(query);
    return res.status(200).json({ response: response });
});

async function askAI(query) {

    const fileData = await fsp.readFile('index.json', 'utf8');
    const index = JSON.parse(fileData);

    console.log('Index:', index);

    const prompt = `Given this file index:\n${JSON.stringify(index, null, 2)}\n\nFind files relevant to: "${query}"`;

    const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
    });

    // console.log('AI Response:', response.choices[0].message.content);
    return response.choices[0].message.content;
}

app.get('/files', async (req, res) => {

    const directorypath = path.dirname(__filename);
    const directoryPath = await fsp.readdir(directorypath); 
    
    let fullPath=[];

    let index=[]
    for (const entry of directoryPath) {
        const fullPath = path.join(directorypath, entry);
        const stat = await fsp.stat(fullPath);

        if (stat.isFile()) {
            const extension = path.extname(entry).toLowerCase();
            const name = path.basename(entry, extension);

            const content = await streamData(fullPath);

            index.push({
                name,
                extension,
                content
            });
            await indexFile(entry, fullPath, content);
        }

       

        fs.writeFile('index.json', JSON.stringify(index, null, 2), (err) => {
            if (err) {
                console.error('Error writing to file', err);
            } else {
                console.log('File written successfully');
            }
        });
        // console.log(index);

    }
   });

   const streamData=(filePath)=>{

    return new Promise((resolve, reject) => {
        const readStream = fs.createReadStream(filePath, {
            encoding: 'utf8'
        });

        let content = '';

        readStream.on('data', chunk => {
            content += chunk;
            console.log('Chunk received:', chunk);
            readStream.destroy(); // Stop after first chunk
        });

        readStream.on('close', () => resolve(content));
        readStream.on('error', reject);
    });
   }


   
app.listen(2500,()=>{
    console.log('Server is running on port 3000');
});
