Modal confirmation, e.g. before discarding a recording.
```jsx
<Dialog title="Discard this take?" onClose={close} actions={<><Button variant="ghost">Keep</Button><Button variant="record">Discard</Button></>}>You'll lose 3:12 of audio.</Dialog>
```
