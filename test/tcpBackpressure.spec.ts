import net from 'net'

describe('TCP backpressure', () => {
  it('Test backpressure', async () => {
    const server = net.createServer((socket) => {
      socket.read()
    })

    const port = 14000
    const host = '127.0.0.1'
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(port, host, resolve)
    })

    const socket = await new Promise<net.Socket>((resolve, reject) => {
      const socket = net.connect(port, host)
      socket.on('connect', () => resolve(socket))
      socket.on('error', reject)
    })

    for (let i = 0; i < 1000; i++) {
      const sent = socket.write(Buffer.alloc(1000))
      console.log(i, sent)
    }
  })
})
