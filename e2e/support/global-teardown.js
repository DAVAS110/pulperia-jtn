// Borra todo lo creado por las pruebas y restaura los saldos de tesorería.
const fs = require("fs");
const path = require("path");
const qa = require("../../backend/tests/qa/helpers");

module.exports = async () => {
  const file = path.join(__dirname, "..", ".fixture.json");
  if (!fs.existsSync(file)) return;
  const fx = JSON.parse(fs.readFileSync(file, "utf8"));
  await qa.teardown({
    tag: fx.tag,
    snapshot: fx.snapshot,
    adminUser: fx.adminUser,
    empUser: fx.empUser,
    extraUserIds: [],
    comboPrefix: fx.comboPrefix,
    server: null,
  });
  fs.unlinkSync(file);
};
