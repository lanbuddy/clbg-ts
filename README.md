# clbg-ts

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/lanbuddy/clbg-ts/blob/main/LICENSE)

A Node.js package for creating, reading and extracting CLBG (**C**ompressed **L**AN**B**uddy **G**ame) files.

## Installation

```bash
npm install clbg-ts
-or-
yarn add clbg-ts
```

## Usage

```typescript
import { CLBGFile } from 'clbg-ts'

// Open clbg file
const clbgFile = await CLBGFile.fromFile("./file.clbg")

// Show metadata
console.log(clbgFile.metadata)

// Extract the cover
await clbgFile.saveCover("./cover.png")

// Extract the game
clbgFile.extractGame("./output_dir/").then(() => {
    console.log("Game extracted.")
});
```

## License

This project is licensed under the MIT License - see the [LICENSE](https://github.com/lanbuddy/clbg-ts/blob/main/LICENSE) file for details.
