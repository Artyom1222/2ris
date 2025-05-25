import { createInterface as initializeCommandLineInterface } from 'readline';
import { homedir as getUserHomeDirectory, EOL as endOfLineMarker, cpus as getCpuInformation, userInfo as getCurrentUserInfo, arch as getSystemArchitecture } from 'os';
import { chdir as changeCurrentDirectory, cwd as getCurrentWorkingDirectory } from 'process';
import { createReadStream as establishReadFlow, createWriteStream as establishWriteFlow } from 'fs';
import { readdir as readDirectoryEntries, writeFile as createNewFileContent, rename as alterItemName, unlink as removeItemFromSystem, stat as getItemMetadata } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { BrotliCompress as BrotliEncodeStream, BrotliDecompress as BrotliDecodeStream } from 'zlib';

const systemProcess = global.process;

// Initial setup: Go to user's home directory
try {
    changeCurrentDirectory(getUserHomeDirectory());
} catch (initializationError) {
    console.error('Critical error during initialization, could not change to home directory:', initializationError);
    systemProcess.exit(1);
}

const cliHandler = initializeCommandLineInterface({
    input: systemProcess.stdin,
    output: systemProcess.stdout
});

const displaySalutation = () => {
    console.log('\n===== Advanced System Navigator Activated =====\n');
};

const displayCurrentPath = () => {
    console.log(`\n[Current Location]: ${getCurrentWorkingDirectory()}`);
    cliHandler.prompt(); // Display prompt after path
};

// --- Command Implementations ---

async function navigateUpward() {
    const usersRoot = path.resolve(getUserHomeDirectory());
    const currentLoc = path.resolve(getCurrentWorkingDirectory());
    if (currentLoc !== usersRoot) {
        changeCurrentDirectory('..');
    } else {
        console.log('Already at the root user directory. Cannot go further up.');
    }
}

async function navigateToSpecificDirectory(destination) {
    if (!destination) throw new Error('Directory path not specified.');
    const prospectivePath = path.resolve(getCurrentWorkingDirectory(), destination);
    await getItemMetadata(prospectivePath); // Validates existence
    changeCurrentDirectory(prospectivePath);
}

async function enumerateDirectoryContents() {
    const entries = await readDirectoryEntries(getCurrentWorkingDirectory(), { withFileTypes: true });
    const formattedEntries = entries
        .map(entry => ({
            Name: entry.name,
            Type: entry.isDirectory() ? 'Folder' : entry.isFile() ? 'File' : 'Other'
        }))
        .sort((itemA, itemB) => {
            if (itemA.Type === itemB.Type) {
                return itemA.Name.localeCompare(itemB.Name);
            }
            return itemA.Type === 'Folder' ? -1 : 1;
        });

    if (formattedEntries.length === 0) {
        console.log('This directory is empty.');
    } else {
        console.table(formattedEntries);
    }
}

async function streamResourceContentToConsole(resourcePath) {
    if (!resourcePath) throw new Error('Resource path not specified.');
    const absolutePath = path.resolve(getCurrentWorkingDirectory(), resourcePath);
    const dataStream = establishReadFlow(absolutePath, { encoding: 'utf8' });

    return new Promise((resolve, reject) => {
        dataStream.on('data', (chunk) => systemProcess.stdout.write(chunk));
        dataStream.on('error', (err) => reject(new Error(`Error reading resource: ${err.message}`)));
        dataStream.on('end', () => {
            systemProcess.stdout.write('\n'); // Ensure newline after content
            resolve();
        });
    });
}

async function generateNewEmptyFile(fileName) {
    if (!fileName) throw new Error('File name not specified.');
    const absolutePath = path.resolve(getCurrentWorkingDirectory(), fileName);
    await createNewFileContent(absolutePath, '', { flag: 'wx' }); // 'wx' to fail if exists
    console.log(`File "${fileName}" created successfully.`);
}

async function modifyResourceName(currentPath, newNameFragment) {
    if (!currentPath || !newNameFragment) throw new Error('Original path or new name not specified.');
    const absoluteOriginalPath = path.resolve(getCurrentWorkingDirectory(), currentPath);
    const containingDirectory = path.dirname(absoluteOriginalPath);
    const absoluteNewPath = path.join(containingDirectory, newNameFragment);
    await alterItemName(absoluteOriginalPath, absoluteNewPath);
    console.log(`Renamed "${currentPath}" to "${newNameFragment}".`);
}

async function transferResourceViaStream(source, destinationContainer, isMoveOperation = false) {
    if (!source || !destinationContainer) throw new Error('Source or destination not specified.');

    const absoluteSourcePath = path.resolve(getCurrentWorkingDirectory(), source);
    const itemName = path.basename(absoluteSourcePath);
    const absoluteDestinationPath = path.resolve(getCurrentWorkingDirectory(), destinationContainer, itemName);

    if (absoluteSourcePath === absoluteDestinationPath) {
        throw new Error('Source and destination paths are identical.');
    }
    
    const sourceMetadata = await getItemMetadata(absoluteSourcePath);
    if(sourceMetadata.isDirectory()){
        throw new Error(`Cannot ${isMoveOperation ? 'move' : 'copy'} a directory with this command.`);
    }


    const readStream = establishReadFlow(absoluteSourcePath);
    const writeStream = establishWriteFlow(absoluteDestinationPath);

    return new Promise((resolve, reject) => {
        readStream.on('error', (err) => reject(new Error(`Read stream error during ${isMoveOperation ? 'move' : 'copy'}: ${err.message}`)));
        writeStream.on('error', (err) => reject(new Error(`Write stream error during ${isMoveOperation ? 'move' : 'copy'}: ${err.message}`)));
        writeStream.on('finish', resolve);
        readStream.pipe(writeStream);
    }).then(async () => {
        if (isMoveOperation) {
            await removeItemFromSystem(absoluteSourcePath);
            console.log(`Moved "${source}" to "${path.join(destinationContainer, itemName)}".`);
        } else {
            console.log(`Copied "${source}" to "${path.join(destinationContainer, itemName)}".`);
        }
    });
}

async function obliterateSystemItem(itemPath) {
    if (!itemPath) throw new Error('Item path not specified.');
    const absolutePath = path.resolve(getCurrentWorkingDirectory(), itemPath);
    await removeItemFromSystem(absolutePath);
    console.log(`Item "${itemPath}" removed.`);
}

async function reportOperatingSystemProperty(propertyKey) {
    if (!propertyKey) throw new Error('OS property key not specified.');
    const propertyAccessors = {
        '--EOL': () => console.log(`Default End-Of-Line sequence: ${JSON.stringify(endOfLineMarker)}`),
        '--cpus': () => {
            const cpusData = getCpuInformation();
            console.log(`CPU Core Information (Total: ${cpusData.length}):`);
            console.table(cpusData.map(cpu => ({ CoreModel: cpu.model, ClockSpeedMHz: cpu.speed })));
        },
        '--homedir': () => console.log(`User Home Directory: ${getUserHomeDirectory()}`),
        '--username': () => console.log(`Current System User: ${getCurrentUserInfo().username}`),
        '--architecture': () => console.log(`System Architecture: ${getSystemArchitecture()}`),
    };
    if (propertyAccessors[propertyKey]) {
        propertyAccessors[propertyKey]();
    } else {
        throw new Error(`Invalid OS property key: ${propertyKey}`);
    }
}

async function generateResourceChecksum(resourcePath) {
    if (!resourcePath) throw new Error('Resource path not specified.');
    const absolutePath = path.resolve(getCurrentWorkingDirectory(), resourcePath);
    const hashAlgorithm = crypto.createHash('sha256');
    const dataStream = establishReadFlow(absolutePath);

    return new Promise((resolve, reject) => {
        dataStream.on('data', (segment) => hashAlgorithm.update(segment));
        dataStream.on('error', (err) => reject(new Error(`Error during hash calculation: ${err.message}`)));
        dataStream.on('end', () => {
            console.log(`SHA256 Checksum for "${resourcePath}": ${hashAlgorithm.digest('hex')}`);
            resolve();
        });
    });
}

async function transformFileWithBrotli(sourcePath, targetPath, mode) {
    if (!sourcePath || !targetPath) throw new Error('Source or target path not specified for transformation.');
    const absoluteSourcePath = path.resolve(getCurrentWorkingDirectory(), sourcePath);
    const absoluteTargetPath = path.resolve(getCurrentWorkingDirectory(), targetPath);

    const readStream = establishReadFlow(absoluteSourcePath);
    const writeStream = establishWriteFlow(absoluteTargetPath);
    const brotliProcessor = mode === 'encode' ? new BrotliEncodeStream() : new BrotliDecodeStream();

    return new Promise((resolve, reject) => {
        readStream.on('error', (err) => reject(new Error(`Read stream error during Brotli ${mode}: ${err.message}`)));
        brotliProcessor.on('error', (err) => reject(new Error(`Brotli stream error during ${mode}: ${err.message}`)));
        writeStream.on('error', (err) => reject(new Error(`Write stream error during Brotli ${mode}: ${err.message}`)));
        writeStream.on('finish', resolve);

        readStream.pipe(brotliProcessor).pipe(writeStream);
    }).then(() => {
        console.log(`File "${sourcePath}" ${mode === 'encode' ? 'compressed' : 'decompressed'} to "${targetPath}".`);
    });
}

// Command mapping
const commandRegistry = {
    'up': navigateUpward,
    'cd': navigateToSpecificDirectory,
    'ls': enumerateDirectoryContents,
    'cat': streamResourceContentToConsole,
    'add': generateNewEmptyFile,
    'rn': modifyResourceName,
    'cp': (source, dest) => transferResourceViaStream(source, dest, false),
    'mv': (source, dest) => transferResourceViaStream(source, dest, true),
    'rm': obliterateSystemItem,
    'os': reportOperatingSystemProperty,
    'hash': generateResourceChecksum,
    'compress': (src, dest) => transformFileWithBrotli(src, dest, 'encode'),
    'decompress': (src, dest) => transformFileWithBrotli(src, dest, 'decode'),
    '.exit': () => {
        console.log('\nAdvanced System Navigator session terminated. Goodbye!');
        systemProcess.exit(0);
    }
};

displaySalutation();
displayCurrentPath();

cliHandler.on('line', async (userInputLine) => {
    const trimmedInput = userInputLine.trim();
    if (!trimmedInput) {
        displayCurrentPath();
        return;
    }

    const [operationName, ...operationArgs] = trimmedInput.split(/\s+/g); // Split by one or more spaces
    const targetFunction = commandRegistry[operationName];

    if (targetFunction) {
        try {
            // Pass arguments according to function arity or as an array
            // For simplicity, this example assumes functions handle their args
            await targetFunction(...operationArgs);
        } catch (executionError) {
            console.error(`Error: Operation failed. Details - ${executionError.message}`);
        }
    } else {
        console.warn('Warning: Unknown operation entered. Please try a valid command.');
    }
    displayCurrentPath();
});

cliHandler.on('close', () => {
    // This might not be reached if .exit is used, but good practice
    console.log('\nAdvanced System Navigator session ended.');
    systemProcess.exit(0);
});

// Set prompt
cliHandler.setPrompt('> ');