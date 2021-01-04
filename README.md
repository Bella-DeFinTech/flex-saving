# flex-saving
Requirement

- `node -v`: 14.x
- `solc --version`: 0.5.15
- yarn
- ganache-cli

## 1.1 Start from scratch

### 1.1.1 Init repo
After clone and `cd` into repo
```
yarn install
```
### 1.1.2 Compile contract

>In project repo
```
npx saddle compile
```

### 1.1.3 run testing
Start ganache-cli in new repo
```
ganache-cli
```

>Back to project repo
```
npx saddle test
```

Tips:

>start local ganachi (default port and params)

>Install native solc and change solc command with saddle-config if you need compile contracts(for now there is already an available contracts.json in .build)


## 1.2 Environment Setup Script

### 1.2.1 Ubuntu 20.04 setup
Script will install:

- nodejs 14.x
- ganache-cli
- yarn
- solc-select

>Recommand use in a clean Ubuntu 20.04 installation
```
sudo apt-get update \
&& sudo apt-get -y upgrade \
&& sudo apt-get --yes install apt-utils \
&& sudo apt-get --yes install apt-transport-https \
&& sudo apt-get --yes install software-properties-common \
&& sudo apt-get --yes install unzip \
&& sudo apt-get --yes install wget \
&& sudo apt-get --yes install curl \
&& sudo apt-get --yes install cmake \
&& sudo apt-get --yes install bzip2 \
&& sudo apt-get --yes install git \
&& sudo apt-get --yes install bash-completion \
&& sudo apt-get update \
&& sudo apt -y install curl dirmngr apt-transport-https lsb-release ca-certificates \
&& curl -sL https://deb.nodesource.com/setup_14.x | sudo -E bash - \
&& sudo apt-get install build-essential checkinstall libssl-dev -y \
&& sudo apt install nodejs -y \
&& node --version \
&& npm --version \
&& sudo apt-get update \
&& sudo npm install -g ganache-cli \
&& curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add - \
&& echo "deb https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list \
&& sudo apt-get update \
&& sudo apt install yarn --yes \
&& cd ~ \
&& wget -O solc https://github.com/ethereum/solc-bin/raw/gh-pages/linux-amd64/solc-linux-amd64-v0.5.15%2Bcommit.6a57276f \
&& sudo chmod +x solc \
&& sudo mv solc /usr/bin
```

Voila!