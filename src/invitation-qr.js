import qrcode from 'qrcode-generator';
window.InkWireQR = (canvas, url) => {
  const qr = qrcode(0, 'M'); qr.addData(url); qr.make();
  const count = qr.getModuleCount(), cell=8, margin=4;
  canvas.width=canvas.height=(count+margin*2)*cell;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#10182e';
  for(let row=0;row<count;row++)for(let col=0;col<count;col++)if(qr.isDark(row,col))ctx.fillRect((col+margin)*cell,(row+margin)*cell,cell,cell);
  return canvas.toDataURL('image/png');
};
