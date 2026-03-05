// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

     //function for capitalizing the first letter of the module name
	function capitalize(str: string, p0: { fields: { name: string; type: string; }[]; "": any; }) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

	// First command: Generate Mern Module
    const disposable = vscode.commands.registerCommand("my-first-extension.generateMernModule",async () => {

			// Prompt user for module name	
			const moduleName = await vscode.window.showInputBox({
				placeHolder: "Enter module name (example: User)",
			});

			// Validate module name and workspace
			if (!moduleName) {
				vscode.window.showErrorMessage("Module name is required!");
				return;
			}

			//field for models
			const fieldInput = await vscode.window.showInputBox({
				placeHolder: "Enter fields (example: name:string, age:number)",
			});

			// Validate fields input
			if (!fieldInput) {
				vscode.window.showErrorMessage("Fields input is required!");
				return;
			}

			// Process fields input into an array of objects with name and type
			const fields = fieldInput.split(",").map((field) => {
				const [name, type] = field.split(":").map((part) => part.trim());
				return { name, type };
			});

			// select the language for the project
			const language = await vscode.window.showQuickPick(["JavaScript", "TypeScript"], {
				placeHolder: "Select the language for the project",
			});

			//select the database for the project
			const database = await vscode.window.showQuickPick(["MongoDB","MySql","Postgresql"], {
				placeHolder: "Select the database for the project",
			});

	        const dblink = await vscode.window.showInputBox({
				placeHolder: "Enter the database connection string (example: mongodb://localhost:27017/mydb)",
			});

			// Validate database connection string		
			if (!dblink) {
				vscode.window.showErrorMessage("Database connection string is required!");
				return;
			}
             
			const db = database === "MongoDB" ? "mongoose" : database === "MySql" ? "mysql2" : "pg";

			// Validate language selection
			if (!language) {
				vscode.window.showErrorMessage("Language selection is required!");
				return;
			}

			// Set file extensions based on language selection
			const Exe = language === "TypeScript" ? "ts" : "js";


			// Prompt user for port number
				const Port = await vscode.window.showInputBox({
				placeHolder: "Enter Port Number (example: 3000)",
			});

			

			// Capitalize the first letter of the module name
			const ModuleName = capitalize(moduleName || '' , { fields, "": '' });

			
			// get the root path of the workspace
			const rootPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;

			// Validate if a workspace is open
			if (!rootPath) {
				vscode.window.showErrorMessage("Open a project folder first!");
				return;
			}

			// Create folders: models, controllers, routes
			const folders = ["models", "controllers", "routes","DB"];

			// Create folders if they don't exist
			folders.forEach((folder) => {
				const folderPath = path.join(rootPath, folder);
				if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath);
			});

			// package.json generate
            const packageJsonPath = path.join(rootPath, "package.json");
			if (!fs.existsSync(packageJsonPath)) {
				const install = await vscode.window.showInformationMessage(
					"package.json not found. Do you want to create one and install dependencies?",
					"Yes",
					"No"
				);
			if (install === "Yes") {
				await vscode.window.withProgress(
					{
						location: vscode.ProgressLocation.Notification,
						title: "Setting up project...",
						cancellable: false,
					},
					async () => {
						await new Promise<void>((resolve, reject) => {
							exec(
								'npm init -y', { cwd: rootPath },
								(error, stdout, stderr) => {
									if (error) {
										vscode.window.showErrorMessage(`Error initializing npm: ${error.message}`);
										reject(error);
										return;
									}
									if (stderr) {
										vscode.window.showErrorMessage(`npm error: ${stderr}`);
										reject(new Error(stderr));
										return;
									}
									vscode.window.showInformationMessage('npm initialized successfully!');
									resolve();
								}
							);
						});
					}
				);
			}

		const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

        const dependencies = packageJson.dependencies || {};

		const required = ['express', db ,'jsonwebtoken','dotenv','cors','bcryptjs','nodemon'];

		const missing = required.filter(dep => !dependencies[dep]);

		if (missing.length > 0) {
  				// ask install only missing ones
				const installDeps = await vscode.window.showInformationMessage(
					`Missing dependencies: ${missing.join(', ')}. Do you want to install them?`,
					"Yes",
					"No"
				);
				if (installDeps === "Yes") {
					vscode.window.withProgress(
						{
							location: vscode.ProgressLocation.Notification,
							title: "Installing dependencies...",
							cancellable: false,
						},
						async () => {
							exec(
								`npm install ${missing.join(' ')}`, { cwd: rootPath },
								(error, stdout, stderr) => {
									if (error) {
										vscode.window.showErrorMessage(`Error installing dependencies: ${error.message}`);
										return;
									}
									if (stderr) {
										vscode.window.showErrorMessage(`npm error: ${stderr}`);
										return;
									}
									vscode.window.showInformationMessage('Dependencies installed successfully!');
								}
							);
						}
					);
				}
			}
            
			// Model
			fs.writeFileSync(
				path.join(rootPath, "models", `${ModuleName}.${Exe}`),
				`import mongoose from 'mongoose';
				 const ${ModuleName}Schema = new mongoose.Schema({
				 ${fields
					 .map((field) => `${field.name}: ${capitalize(field.type || '', { fields, "": '' })}`)
					 .join(",\n")}
				 });
				 export default mongoose.model('${ModuleName}', ${ModuleName}Schema);`
			);

			//Controller
			fs.writeFileSync(
				path.join(rootPath, "controllers", `${ModuleName}.Controller.${Exe}`),
				`import ${ModuleName} from '../models/${ModuleName}';
				 export const create${ModuleName} = async (req, res) => {
				 try {
					 const new${ModuleName} = new ${ModuleName}(req.body);
					 const saved${ModuleName} = await new${ModuleName}.save();
					 res.status(201).json(saved${ModuleName});
				 } catch (error) {
					 res.status(500).json({ error: 'Failed to create ${ModuleName}' });
				 }
				 };
				 
				 export const get${ModuleName}s = async (req, res) => {
				 try {
					 const ${moduleName}s = await ${ModuleName}.find();
					 res.status(200).json(${moduleName}s);
				 } catch (error) {
					 res.status(500).json({ error: 'Failed to fetch ${moduleName}s' });
				 }
				 };
				 
				 export const get${ModuleName}ById = async (req, res) => {
				 try {
					 const ${moduleName} = await ${ModuleName}.findById(req.params.id);
					 if (!${moduleName}) {
						 return res.status(404).json({ error: '${ModuleName} not found' });
					 }
					 res.status(200).json(${moduleName});
				 } catch (error) {
					 res.status(500).json({ error: 'Failed to fetch ${ModuleName}' });
				 }
				 };
				 
				 export const update${ModuleName} = async (req, res) => {
				 try {
					 const updated${ModuleName} = await ${ModuleName}.findByIdAndUpdate(
						 req.params.id,
						 req.body,
						 { new: true }
					 );
					 if (!updated${ModuleName}) {
						 return res.status(404).json({ error: '${ModuleName} not found' });
					 }
					 res.status(200).json(updated${ModuleName});
				 } catch (error) {
					 res.status(500).json({ error: 'Failed to update ${ModuleName}' });
				 }
				 };
				 
				 export const delete${ModuleName} = async (req, res) => {
				 try {
					 const deleted${ModuleName} = await ${ModuleName}.findByIdAndDelete(req.params.id);
					 if (!deleted${ModuleName}) {
						 return res.status(404).json({ error: '${ModuleName} not found' });
					 }
					 res.status(200).json({ message: '${ModuleName} deleted successfully' });
				 } catch (error) {
					 res.status(500).json({ error: 'Failed to delete ${ModuleName}' });
				 }
				 };`
			);

			//DB
			fs.writeFileSync(
				path.join(rootPath, "DB", `db.${Exe}`),
				`import ${db} from '${dblink}';
				 import dotenv from 'dotenv';
				 dotenv.config();

				 ${db}.connect((err) => {
					 if (err) {
						 console.error('Database connection error:', err);
					 } else {
						 console.log('Connected to the database successfully!');
					 }
				 });`
			);

			// ROUTE
			fs.writeFileSync(
				path.join(rootPath, 'routes', `${ModuleName}.routes.${Exe}`),
				`import express from 'express';
				 import {
				 create${ModuleName},
				 get${ModuleName}s,
				 get${ModuleName}ById,
				 update${ModuleName},
				 delete${ModuleName}
				 } from '../controllers/${ModuleName}.Controller';
				 const router = express.Router();
				 
				 router.post('/', create${ModuleName});
				 router.get('/', get${ModuleName}s);
				 router.get('/:id', get${ModuleName}ById);
				 router.put('/:id', update${ModuleName});
				 router.delete('/:id', delete${ModuleName});
				 
				 export default router;`
			);
			
			fs.writeFileSync(
				path.join(rootPath,`server.${Exe}`),
				`import express from 'express';
				 import mongoose from 'mongoose';
				 import ${ModuleName}Routes from './routes/${ModuleName}.routes';
				 const app = express();
				 const PORT = process.env.PORT || ${Port};
				 
				 app.use(express.json());
				 app.use('/api/${moduleName}s', ${ModuleName}Routes);
				 
				 mongoose.connect(process.env.MONGO_URI, {
					 useNewUrlParser: true,
					 useUnifiedTopology: true,
				 }).then(() => {
					 console.log('Connected to MongoDB');
					 app.listen(PORT, () => {
						 console.log(\`Server running on port \${PORT}\`);
					 });
				 }).catch((error) => {
					 console.error('MongoDB connection error:', error);
				 });`
			);

			fs.writeFileSync(
				path.join(rootPath,`.env`),
				`PORT=${Port}
                MONGO_URI=your_mongodb_connection_string_here`
			); 
			
			vscode.window.showInformationMessage(
				`${ModuleName} module generated successfully!`
			);
			}
  
});

  context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
