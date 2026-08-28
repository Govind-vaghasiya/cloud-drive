const fs = require('fs');
(async () => {
  await fs.promises.writeFile('test.tmp', Buffer.alloc(0));
  const fh = await fs.promises.open('test.tmp', 'r+');
  await fh.write(Buffer.from('hello'), 0, 5, 10);
  await fh.close();
  const b = await fs.promises.readFile('test.tmp');
  console.log('Size:', b.length);
})();
