```
⚠️ This was an experiment that is no longer maintained.

We encourage others to pick up the idea and develop it.
```

# solidity-loader

Works well with [OpenZeppelin SDK](https://openzeppelin.com/sdk/) and [Starter Kit](https://openzeppelin.com/start/).

#### Features

- Allows importing .sol files directly into source code.
- Allows to specify contract name for .sol files, like require("Contract.sol?contract=Counter").
- Tracks dependencies for contracts, so children are updated when parents are modified.
- Converts .sol files into .json using `compile oz`, `oz push`, and `oz update`.
- Uses only development network so won't run on any other networks.
- You can set the development network name using the loader's config.
- Handles race conditions at Webpack pipeline using a lock.
- Pulls build directory from truffle config.
- In case oz commands are not available, uses cached versions of .json files.
- Reports errors to console output and dev tools.
- Compilation can be disabled using the loader's disabled config.

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
