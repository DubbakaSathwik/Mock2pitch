Upload target for slide decks; dashed icy-blue zone that becomes a file row.
```jsx
<FileDropzone onSelect={f=>setFile({name:f.name,meta:'18 slides'})} />
<FileDropzone file={{name:'Hackathon-demo.pptx',meta:'12 slides · 4.2 MB'}} onClear={()=>setFile(null)} />
```
