# solidity-loader
Works well with [OpenZeppelin SKD](https://openzeppelin.com/sdk/) and [Starter Kit](https://openzeppelin.com/start/).
#### Features
* Allows to import .sol files directly into source code.
* Allows to specify contract name for .sol files, like require("Contract.sol?contract=Counter").
* Tracks dependencies for contracts, so children are updated when parents are modified.
* Converts .sol files into .json using compile->zos push->zos update.
* Uses only development network, so won't run on any other networks.
* You can set development network name using loader's config.
* Handles race conditions at webpack pipeline using lock.
* Pulls build directory from truffle config.
* In case zos command not available, uses cached versions of .json files.
* Reports error to console output and dev tools.
* Compilation can be disabled using loader's disabled config.

#### Import example
```
Counter = require("../../contracts/Counter.sol");
Wallet = require("../../contracts/Wallet.sol");
```

#### Config sample
```
{
    test: /.sol$/,
    use: [
    { loader: 'json-loader' },
    {
        loader: '@openzeppelin/solidity-loader',
        options: {
            network: 'development',
            disabled: false,
            }
         },
      },
    ],
}
```