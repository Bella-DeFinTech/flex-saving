# flex-saving
test process：
1. install yarn
2. switch node version >= 14
3. cd flex-saving
4. yarn install
5. start local ganachi (default port and params)
6. change .ganache/accounts with ganachi generated private keys
7. install native solc and change solc command with saddle-config if you need compile contracts(for now there is already an available contracts.json in .build)
8. npx saddle compile
9. npx saddle test
