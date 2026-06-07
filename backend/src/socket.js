let io = null;

const setIO = (server) => {
  io = server;
};

const getIO = () => io;

module.exports = { setIO, getIO };
