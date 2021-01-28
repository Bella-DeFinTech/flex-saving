var abiArray = [{"name":"Minted","inputs":[{"type":"address","name":"recipient","indexed":true},{"type":"address","name":"gauge","indexed":false},{"type":"uint256","name":"minted","indexed":false}],"anonymous":false,"type":"event"},{"outputs":[],"inputs":[{"type":"address","name":"_token"},{"type":"address","name":"_controller"}],"stateMutability":"nonpayable","type":"constructor"},{"name":"mint","outputs":[],"inputs":[{"type":"address","name":"gauge_addr"}],"stateMutability":"nonpayable","type":"function","gas":100038},{"name":"mint_many","outputs":[],"inputs":[{"type":"address[8]","name":"gauge_addrs"}],"stateMutability":"nonpayable","type":"function","gas":408502},{"name":"mint_for","outputs":[],"inputs":[{"type":"address","name":"gauge_addr"},{"type":"address","name":"_for"}],"stateMutability":"nonpayable","type":"function","gas":101219},{"name":"toggle_approve_mint","outputs":[],"inputs":[{"type":"address","name":"minting_user"}],"stateMutability":"nonpayable","type":"function","gas":36726},{"name":"token","outputs":[{"type":"address","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":1301},{"name":"controller","outputs":[{"type":"address","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":1331},{"name":"minted","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"address","name":"arg0"},{"type":"address","name":"arg1"}],"stateMutability":"view","type":"function","gas":1669},{"name":"allowed_to_mint_for","outputs":[{"type":"bool","name":""}],"inputs":[{"type":"address","name":"arg0"},{"type":"address","name":"arg1"}],"stateMutability":"view","type":"function","gas":1699}]

module.exports = {
    abiArray
}