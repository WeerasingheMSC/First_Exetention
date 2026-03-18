// The module 'vscode' contains the VS Code extensibility API
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import { BackendGeneratorSidebarProvider } from "./sidebar";

// Helper: capitalize first letter
function capitalize(str: string): string {
	return str.charAt(0).toUpperCase() + str.slice(1);
}

// Helper: run a shell command and return a Promise
function runCommand(command: string, cwd: string): Promise<void> {
	return new Promise((resolve, reject) => {
		// Pass the full process environment so tools like npm/node are always
		// found regardless of how PATH is set (nvm, fnm, Homebrew, etc.).
		// maxBuffer is raised to 50 MB — npm install can produce large output.
		exec(command, { cwd, env: { ...process.env }, maxBuffer: 50 * 1024 * 1024 }, (error, _stdout, _stderr) => {
			// Only reject when exec itself reports a non-zero exit code.
			// npm writes progress, warnings, and peer-dep notices to stderr even
			// on success — we must NOT inspect stderr for the word "error".
			if (error) {
				reject(error);
				return;
			}
			resolve();
		});
	});
}

// ─── Structure Layouts ───────────────────────────────────────────────────────

interface StructureLayout {
	folders: string[];
	modelsDir: string;
	controllersDir: string;
	routesDir: string;
	dbDir: string;
	middlewareDir: string;
	modelImportInController: string;
	dbImportInController: string;
	controllerImportInRoute: string;
	routeImportInServer: (ModuleName: string) => string;
	modelImportInServer: (ModuleName: string) => string;
	authRouteImportInServer: string;
	dbImportInServer: string;
	userModelImportInAuthController: string;
	authControllerImportInAuthRoute: string;
	authMiddlewareImportInAuthRoute: string;
}

function getStructureLayout(structure: string): StructureLayout {
	switch (structure) {
		case "advanced":
			return {
				folders: ["src/models", "src/controllers", "src/routes", "src/services", "src/middleware", "src/utils", "src/config"],
				modelsDir: "src/models",
				controllersDir: "src/controllers",
				routesDir: "src/routes",
				dbDir: "src/config",
				middlewareDir: "src/middleware",
				modelImportInController: "../models",
				dbImportInController: "../config/db",
				controllerImportInRoute: "../controllers",
				routeImportInServer: (M: string) => `./src/routes/${M}.routes`,
				modelImportInServer: (M: string) => `./src/models/${M}`,
				authRouteImportInServer: "./src/routes/auth.routes",
				dbImportInServer: "./src/config/db",
				userModelImportInAuthController: "../models/User",
				authControllerImportInAuthRoute: "../controllers/auth.controller",
				authMiddlewareImportInAuthRoute: "../middleware/auth.middleware",
			};
		case "clean":
			return {
				folders: ["src/domain/models", "src/application/services", "src/infrastructure/db", "src/presentation/controllers", "src/presentation/routes", "src/presentation/middleware", "src/utils"],
				modelsDir: "src/domain/models",
				controllersDir: "src/presentation/controllers",
				routesDir: "src/presentation/routes",
				dbDir: "src/infrastructure/db",
				middlewareDir: "src/presentation/middleware",
				modelImportInController: "../../domain/models",
				dbImportInController: "../../infrastructure/db/db",
				controllerImportInRoute: "../controllers",
				routeImportInServer: (M: string) => `./src/presentation/routes/${M}.routes`,
				modelImportInServer: (M: string) => `./src/domain/models/${M}`,
				authRouteImportInServer: "./src/presentation/routes/auth.routes",
				dbImportInServer: "./src/infrastructure/db/db",
				userModelImportInAuthController: "../../domain/models/User",
				authControllerImportInAuthRoute: "../controllers/auth.controller",
				authMiddlewareImportInAuthRoute: "../middleware/auth.middleware",
			};
		default: // simple
			return {
				folders: ["models", "controllers", "routes", "DB", "middleware"],
				modelsDir: "models",
				controllersDir: "controllers",
				routesDir: "routes",
				dbDir: "DB",
				middlewareDir: "middleware",
				modelImportInController: "../models",
				dbImportInController: "../DB/db",
				controllerImportInRoute: "../controllers",
				routeImportInServer: (M: string) => `./routes/${M}.routes`,
				modelImportInServer: (M: string) => `./models/${M}`,
				authRouteImportInServer: "./routes/auth.routes",
				dbImportInServer: "./DB/db",
				userModelImportInAuthController: "../models/User",
				authControllerImportInAuthRoute: "../controllers/auth.controller",
				authMiddlewareImportInAuthRoute: "../middleware/auth.middleware",
			};
	}
}

// ─── File generators ────────────────────────────────────────────────────────

function generateEnv(port: string, db: string, dblink: string): string {
	return `PORT=${port}\nDB_URI=${dblink}\n`;
}

function generateTsConfig(): string {
	return JSON.stringify(
		{
			compilerOptions: {
				target: "ES2020",
				module: "commonjs",
				lib: ["ES2020"],
				outDir: "./dist",
				rootDir: "./",
				strict: true,
				esModuleInterop: true,
				skipLibCheck: true,
				resolveJsonModule: true,
			},
			include: ["./**/*.ts"],
			exclude: ["node_modules", "dist"],
		},
		null,
		2
	);
}

// ── DB connection file ───────────────────────────────────────────────────────

function generateDbFile(db: string, exe: string): string {
	if (db === "mongoose") {
		return `import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const connectDB = async (): Promise<void> => {
  try {
    await mongoose.connect(process.env.DB_URI as string);
    console.log('MongoDB connected successfully');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
};

export default connectDB;
`;
	}
	if (db === "mysql2") {
		return `import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const pool = mysql.createPool(process.env.DB_URI as string);

export const testConnection = async (): Promise<void> => {
  const conn = await pool.getConnection();
  console.log('MySQL connected successfully');
  conn.release();
};

export default pool;
`;
	}
	// pg
	return `import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DB_URI });

export const testConnection = async (): Promise<void> => {
  const client = await pool.connect();
  console.log('PostgreSQL connected successfully');
  client.release();
};

export default pool;
`;
}

// ── Model files ──────────────────────────────────────────────────────────────

function mongooseTypeMap(t: string): string {
	const map: Record<string, string> = {
		string: "String",
		number: "Number",
		boolean: "Boolean",
		date: "Date",
	};
	return map[t?.toLowerCase()] ?? "String";
}

function sqlTypeMap(t: string): string {
	const map: Record<string, string> = {
		string: "VARCHAR(255)",
		number: "INT",
		boolean: "BOOLEAN",
		date: "DATE",
	};
	return map[t?.toLowerCase()] ?? "VARCHAR(255)";
}

function generateModel(
	ModuleName: string,
	fields: { name: string; type: string }[],
	db: string,
	exe: string,
	dbImport: string = "../config/db"
): string {
	if (db === "mongoose") {
		const schemaFields = fields
			.map((f) => `  ${f.name}: { type: ${mongooseTypeMap(f.type)}, required: true }`)
			.join(",\n");
		return exe === "ts"
			? `import mongoose from 'mongoose';\n\nconst ${ModuleName}Schema = new mongoose.Schema(\n  {\n${schemaFields}\n  },\n  { timestamps: true }\n);\n\nexport default mongoose.model('${ModuleName}', ${ModuleName}Schema);\n`
			: `const mongoose = require('mongoose');\n\nconst ${ModuleName}Schema = new mongoose.Schema(\n  {\n${schemaFields}\n  },\n  { timestamps: true }\n);\n\nmodule.exports = mongoose.model('${ModuleName}', ${ModuleName}Schema);\n`;
	}

	const tableName = `${ModuleName.toLowerCase()}s`;
	const sqlFields = fields.map((f) => `  ${f.name}: ${f.type === 'number' ? 'number' : f.type === 'boolean' ? 'boolean' : f.type === 'date' ? 'Date' : 'string'};`).join("\n");
	const tableDefs = fields.map((f) => `      ${f.name} ${sqlTypeMap(f.type)}`).join(",\n");
	const isMysql = db === "mysql2";
	
	const createParams = fields.map((f) => `${f.name}: ${f.type}`).join(", ");
	const createArgs = fields.map((f) => f.name).join(", ");
	const queryMethod = isMysql ? "execute" : "query";
	const insertPlaceholders = isMysql ? fields.map(() => "?").join(", ") : fields.map((_, i) => `$${i + 1}`).join(", ");

	if (exe === "ts") {
		return `import pool from '${dbImport}';

export interface I${ModuleName} {
  id: number;
${sqlFields}
  created_at: Date;
}

export const init${ModuleName}sTable = async (): Promise<void> => {
  await pool.${queryMethod}(\`
    CREATE TABLE IF NOT EXISTS ${tableName} (
      ${isMysql ? "id INT AUTO_INCREMENT PRIMARY KEY," : "id SERIAL PRIMARY KEY,"}
${tableDefs},
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  \`);
  console.log("${ModuleName}s table ready");
};

export const ${ModuleName} = {
  async create(${createParams}): Promise<I${ModuleName}> {
    const ${isMysql ? "[result]" : "result"} = await pool.${queryMethod}<any>(
      \`INSERT INTO ${tableName} (${createArgs}) VALUES (${insertPlaceholders}) ${isMysql ? "" : "RETURNING *"}\`,
      [${createArgs}]
    );
    return ${isMysql ? `{ id: result.insertId, ${createArgs}, created_at: new Date() }` : `result.rows[0]`};
  },
  async findAll(): Promise<I${ModuleName}[]> {
    const ${isMysql ? "[rows]" : "result"} = await pool.${queryMethod}<any${isMysql ? "[]" : ""}>(\`SELECT * FROM ${tableName}\`);
    return ${isMysql ? "rows" : "result.rows"};
  },
  async findById(id: number): Promise<I${ModuleName} | null> {
    const ${isMysql ? "[rows]" : "result"} = await pool.${queryMethod}<any${isMysql ? "[]" : ""}>(\`SELECT * FROM ${tableName} WHERE id = ${isMysql ? "?" : "$1"}\`, [id]);
    const row = ${isMysql ? "rows[0]" : "result.rows[0]"};
    return row ?? null;
  },
  async update(id: number, ${createParams}): Promise<boolean> {
    const ${isMysql ? "[result]" : "result"} = await pool.${queryMethod}<any>(
      \`UPDATE ${tableName} SET ${fields.map((f, i) => `${f.name} = ${isMysql ? "?" : `$${i + 1}`}`).join(", ")} WHERE id = ${isMysql ? "?" : `$${fields.length + 1}`}\`,
      [${createArgs}, id]
    );
    return ${isMysql ? "result.affectedRows > 0" : "result.rowCount > 0"};
  },
  async delete(id: number): Promise<boolean> {
    const ${isMysql ? "[result]" : "result"} = await pool.${queryMethod}<any>(\`DELETE FROM ${tableName} WHERE id = ${isMysql ? "?" : "$1"}\`, [id]);
    return ${isMysql ? "result.affectedRows > 0" : "result.rowCount > 0"};
  }
};

init${ModuleName}sTable().catch(console.error);
`;
	}

	// JavaScript SQL
	return `const ${isMysql ? "{ pool }" : "pool"} = require('${dbImport}');

const init${ModuleName}sTable = async () => {
  await pool.${queryMethod}(\`
    CREATE TABLE IF NOT EXISTS ${tableName} (
      ${isMysql ? "id INT AUTO_INCREMENT PRIMARY KEY," : "id SERIAL PRIMARY KEY,"}
${tableDefs},
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  \`);
  console.log("${ModuleName}s table ready");
};

const ${ModuleName} = {
  async create(${createArgs}) {
    const ${isMysql ? "[result]" : "result"} = await pool.${queryMethod}(
      \`INSERT INTO ${tableName} (${createArgs}) VALUES (${insertPlaceholders}) ${isMysql ? "" : "RETURNING *"}\`,
      [${createArgs}]
    );
    return ${isMysql ? `{ id: result.insertId, ${createArgs}, created_at: new Date() }` : `result.rows[0]`};
  },
  async findAll() {
    const ${isMysql ? "[rows]" : "result"} = await pool.${queryMethod}(\`SELECT * FROM ${tableName}\`);
    return ${isMysql ? "rows" : "result.rows"};
  },
  async findById(id) {
    const ${isMysql ? "[rows]" : "result"} = await pool.${queryMethod}(\`SELECT * FROM ${tableName} WHERE id = ${isMysql ? "?" : "$1"}\`, [id]);
    const row = ${isMysql ? "rows[0]" : "result.rows[0]"};
    return row || null;
  },
  async update(id, ${createArgs}) {
    const ${isMysql ? "[result]" : "result"} = await pool.${queryMethod}(
      \`UPDATE ${tableName} SET ${fields.map((f, i) => `${f.name} = ${isMysql ? "?" : `$${i + 1}`}`).join(", ")} WHERE id = ${isMysql ? "?" : `$${fields.length + 1}`}\`,
      [${createArgs}, id]
    );
    return ${isMysql ? "result.affectedRows > 0" : "result.rowCount > 0"};
  },
  async delete(id) {
    const ${isMysql ? "[result]" : "result"} = await pool.${queryMethod}(\`DELETE FROM ${tableName} WHERE id = ${isMysql ? "?" : "$1"}\`, [id]);
    return ${isMysql ? "result.affectedRows > 0" : "result.rowCount > 0"};
  }
};

init${ModuleName}sTable().catch(console.error);

module.exports = ${ModuleName};
`;
}

// ── Controllers ──────────────────────────────────────────────────────────────

function generateMongooseController(ModuleName: string, moduleName: string, exe: string, modelImport = "../models"): string {
	return `import { Request, Response } from 'express';
import ${ModuleName} from '${modelImport}/${ModuleName}';

export const create${ModuleName} = async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = new ${ModuleName}(req.body);
    const saved = await doc.save();
    res.status(201).json(saved);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create ${ModuleName}', details: (error as Error).message });
  }
};

export const get${ModuleName}s = async (_req: Request, res: Response): Promise<void> => {
  try {
    const items = await ${ModuleName}.find();
    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch ${moduleName}s', details: (error as Error).message });
  }
};

export const get${ModuleName}ById = async (req: Request, res: Response): Promise<void> => {
  try {
    const item = await ${ModuleName}.findById(req.params.id);
    if (!item) { res.status(404).json({ error: '${ModuleName} not found' }); return; }
    res.status(200).json(item);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch ${ModuleName}', details: (error as Error).message });
  }
};

export const update${ModuleName} = async (req: Request, res: Response): Promise<void> => {
  try {
    const updated = await ${ModuleName}.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) { res.status(404).json({ error: '${ModuleName} not found' }); return; }
    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update ${ModuleName}', details: (error as Error).message });
  }
};

export const delete${ModuleName} = async (req: Request, res: Response): Promise<void> => {
  try {
    const deleted = await ${ModuleName}.findByIdAndDelete(req.params.id);
    if (!deleted) { res.status(404).json({ error: '${ModuleName} not found' }); return; }
    res.status(200).json({ message: '${ModuleName} deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete ${ModuleName}', details: (error as Error).message });
  }
};
`;
}

function generateSqlController(
	ModuleName: string,
	moduleName: string,
	fields: { name: string; type: string }[],
	db: string,
	exe: string,
	modelImport = "../models"
): string {
	const table = `${moduleName}s`;
	const cols = fields.map((f) => f.name).join(", ");
	const reqBodyArgs = fields.map(f => `req.body.${f.name}`);

	if (exe === "ts") {
		return `import { Request, Response } from 'express';
import { ${ModuleName} } from '${modelImport}/${ModuleName}';

export const create${ModuleName} = async (req: Request, res: Response): Promise<void> => {
  try {
    const { ${cols} } = req.body;
    const result = await ${ModuleName}.create(${cols});
    res.status(201).json({ message: '${ModuleName} created', data: result });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create ${ModuleName}', details: (error as Error).message });
  }
};

export const get${ModuleName}s = async (_req: Request, res: Response): Promise<void> => {
  try {
    const rows = await ${ModuleName}.findAll();
    res.status(200).json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch ${moduleName}s', details: (error as Error).message });
  }
};

export const get${ModuleName}ById = async (req: Request, res: Response): Promise<void> => {
  try {
    const row = await ${ModuleName}.findById(Number(req.params.id));
    if (!row) { res.status(404).json({ error: '${ModuleName} not found' }); return; }
    res.status(200).json(row);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch ${ModuleName}', details: (error as Error).message });
  }
};

export const update${ModuleName} = async (req: Request, res: Response): Promise<void> => {
  try {
    const { ${cols} } = req.body;
    const success = await ${ModuleName}.update(Number(req.params.id), ${cols});
    if (!success) { res.status(404).json({ error: '${ModuleName} not found' }); return; }
    res.status(200).json({ message: '${ModuleName} updated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update ${ModuleName}', details: (error as Error).message });
  }
};

export const delete${ModuleName} = async (req: Request, res: Response): Promise<void> => {
  try {
    const success = await ${ModuleName}.delete(Number(req.params.id));
    if (!success) { res.status(404).json({ error: '${ModuleName} not found' }); return; }
    res.status(200).json({ message: '${ModuleName} deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete ${ModuleName}', details: (error as Error).message });
  }
};
`;
	}

	return `const ${ModuleName} = require('${modelImport}/${ModuleName}');

exports.create${ModuleName} = async (req, res) => {
  try {
    const { ${cols} } = req.body;
    const result = await ${ModuleName}.create(${cols});
    res.status(201).json({ message: '${ModuleName} created', data: result });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create ${ModuleName}', details: error.message });
  }
};

exports.get${ModuleName}s = async (req, res) => {
  try {
    const rows = await ${ModuleName}.findAll();
    res.status(200).json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch ${moduleName}s', details: error.message });
  }
};

exports.get${ModuleName}ById = async (req, res) => {
  try {
    const row = await ${ModuleName}.findById(req.params.id);
    if (!row) { return res.status(404).json({ error: '${ModuleName} not found' }); }
    res.status(200).json(row);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch ${ModuleName}', details: error.message });
  }
};

exports.update${ModuleName} = async (req, res) => {
  try {
    const { ${cols} } = req.body;
    const success = await ${ModuleName}.update(req.params.id, ${cols});
    if (!success) { return res.status(404).json({ error: '${ModuleName} not found' }); }
    res.status(200).json({ message: '${ModuleName} updated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update ${ModuleName}', details: error.message });
  }
};

exports.delete${ModuleName} = async (req, res) => {
  try {
    const success = await ${ModuleName}.delete(req.params.id);
    if (!success) { return res.status(404).json({ error: '${ModuleName} not found' }); }
    res.status(200).json({ message: '${ModuleName} deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete ${ModuleName}', details: error.message });
  }
};
`;
}

// ── Routes ───────────────────────────────────────────────────────────────────

function generateRoutes(ModuleName: string, exe: string, ctrlImport = "../controllers"): string {
	if (exe === "js") {
		return `const express = require('express');
const {
  create${ModuleName},
  get${ModuleName}s,
  get${ModuleName}ById,
  update${ModuleName},
  delete${ModuleName},
} = require('${ctrlImport}/${ModuleName}.controller');

const router = express.Router();

router.post('/', create${ModuleName});
router.get('/', get${ModuleName}s);
router.get('/:id', get${ModuleName}ById);
router.put('/:id', update${ModuleName});
router.delete('/:id', delete${ModuleName});

module.exports = router;
`;
	}
	return `import { Router } from 'express';
import {
  create${ModuleName},
  get${ModuleName}s,
  get${ModuleName}ById,
  update${ModuleName},
  delete${ModuleName},
} from '${ctrlImport}/${ModuleName}.controller';

const router = Router();

router.post('/', create${ModuleName});
router.get('/', get${ModuleName}s);
router.get('/:id', get${ModuleName}ById);
router.put('/:id', update${ModuleName});
router.delete('/:id', delete${ModuleName});

export default router;
`;
}

// ── Server ───────────────────────────────────────────────────────────────────

function generateServer(
	ModuleName: string,
	moduleName: string,
	port: string,
	db: string,
	exe: string,
	layout: StructureLayout = getStructureLayout("simple")
): string {
	if (exe === "js") {
		const dbRequire =
			db === "mongoose"
				? `const connectDB = require('${layout.dbImportInServer}');`
				: `const { testConnection } = require('${layout.dbImportInServer}');\nrequire('${layout.modelImportInServer('User')}');\nrequire('${layout.modelImportInServer(ModuleName)}');`;
		const dbInit =
			db === "mongoose"
				? `connectDB();`
				: `testConnection().catch(console.error);`;
		return `const express = require('express');
const cors = require('cors');
require('dotenv').config();
${dbRequire}
const ${moduleName}Router = require('${layout.routeImportInServer(ModuleName)}');
const authRouter = require('${layout.authRouteImportInServer}');

const app = express();
const PORT = process.env.PORT || ${port};

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection
${dbInit}

// Routes
app.use('/api/${moduleName}s', ${moduleName}Router);
app.use('/api/auth', authRouter);

// Health check
app.get('/health', (_req, res) => res.json({ status: 'OK' }));

app.listen(PORT, () => {
  console.log(\`Server is running on http://localhost:\${PORT}\`);
});

module.exports = app;
`;
	}

	const dbImport =
		db === "mongoose"
			? `import connectDB from '${layout.dbImportInServer}';`
			: `import pool, { testConnection } from '${layout.dbImportInServer}';\nimport '${layout.modelImportInServer('User')}';\nimport '${layout.modelImportInServer(ModuleName)}';`;

	const dbInit =
		db === "mongoose"
			? `connectDB();`
			: `testConnection().catch(console.error);`;

	return `import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
${dbImport}
import ${moduleName}Router from '${layout.routeImportInServer(ModuleName)}';
import authRouter from '${layout.authRouteImportInServer}';

dotenv.config();

const app = express();
const PORT = process.env.PORT || ${port};

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection
${dbInit}

// Routes
app.use('/api/${moduleName}s', ${moduleName}Router);
app.use('/api/auth', authRouter);

// Health check
app.get('/health', (_req, res) => res.json({ status: 'OK' }));

app.listen(PORT, () => {
  console.log(\`Server is running on http://localhost:\${PORT}\`);
});

export default app;
`;
}

// ─── Extension activation ────────────────────────────────────────────────────

// Detect language / db / structure from an existing generated project
function detectProjectConfig(rootPath: string): { exe: "ts" | "js"; db: string; layout: StructureLayout } {
	const exe: "ts" | "js" = fs.existsSync(path.join(rootPath, "server.ts")) ? "ts" : "js";

	let db = "mongoose";
	const pkgPath = path.join(rootPath, "package.json");
	if (fs.existsSync(pkgPath)) {
		try {
			const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
			const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
			if (deps["mysql2"]) { db = "mysql2"; }
			else if (deps["pg"]) { db = "pg"; }
		} catch { /* default to mongoose */ }
	}

	let structure = "simple";
	if (fs.existsSync(path.join(rootPath, "src", "presentation"))) {
		structure = "clean";
	} else if (fs.existsSync(path.join(rootPath, "src", "controllers"))) {
		structure = "advanced";
	}

	return { exe, db, layout: getStructureLayout(structure) };
}

// Insert a new line after the last line that matches `linePattern` (optionally preferring lines matching `routeHint`)
function insertAfterLastMatch(content: string, linePattern: RegExp, newLine: string, routeHint?: RegExp): string {
	const lines = content.split("\n");
	let lastIdx = -1;

	for (let i = 0; i < lines.length; i++) {
		if (linePattern.test(lines[i]) && (!routeHint || routeHint.test(lines[i]))) {
			lastIdx = i;
		}
	}
	// fallback: match without routeHint
	if (lastIdx === -1 && routeHint) {
		for (let i = 0; i < lines.length; i++) {
			if (linePattern.test(lines[i])) { lastIdx = i; }
		}
	}
	if (lastIdx === -1) { return content + "\n" + newLine; }
	lines.splice(lastIdx + 1, 0, newLine);
	return lines.join("\n");
}

// Add a new route import + mount point to an existing server file
function updateServerFile(content: string, ModuleName: string, moduleName: string, exe: string, layout: StructureLayout, db?: string): string {
	const routePath = layout.routeImportInServer(ModuleName);
	const varName   = `${moduleName}Router`;
	const newMount  = `app.use('/api/${moduleName}s', ${varName});`;

	let updated: string = content;

	if (db === 'mysql' || db === 'postgres') {
		const modelPath = layout.modelImportInServer(ModuleName);
		if (exe === "ts") {
			const modelImport = `import '${modelPath}';`;
			updated = insertAfterLastMatch(updated, /^import .+ from '.+';$/, modelImport, /routes|models/);
		} else {
			const modelImport = `require('${modelPath}');`;
			updated = insertAfterLastMatch(updated, /^const \w+ = require\(/, modelImport, /routes|models/);
		}
	}

	if (exe === "ts") {
		const newImport = `import ${varName} from '${routePath}';`;
		updated = insertAfterLastMatch(updated, /^import .+ from '.+';$/, newImport, /routes/);
	} else {
		const newRequire = `const ${varName} = require('${routePath}');`;
		updated = insertAfterLastMatch(updated, /^const \w+ = require\(/, newRequire, /routes/);
	}
	updated = insertAfterLastMatch(updated, /^app\.use\(['"]\/api\//, newMount);
	return updated;
}

export function activate(context: vscode.ExtensionContext) {
	const disposable = vscode.commands.registerCommand(
		"my-first-extension.generateMernModule",
		async () => {
			// ── 1. Collect inputs ──────────────────────────────────────────────

			const moduleName = await vscode.window.showInputBox({
				placeHolder: "Enter module name (example: User)",
				prompt: "Module name (PascalCase recommended)",
			});
			if (!moduleName) {
				vscode.window.showErrorMessage("Module name is required!");
				return;
			}
			if (!/^[A-Za-z][A-Za-z0-9]*$/.test(moduleName)) {
				vscode.window.showErrorMessage("Module name must start with a letter and contain only letters and digits (e.g. Product, UserProfile).");
				return;
			}

			const fieldInput = await vscode.window.showInputBox({
				placeHolder: "Enter fields (example: name:string, age:number)",
				prompt: "Supported types: string, number, boolean, date",
			});
			if (!fieldInput) {
				vscode.window.showErrorMessage("Fields input is required!");
				return;
			}

			const fields = fieldInput.split(",").map((f) => {
				const [name, type] = f.split(":").map((p) => p.trim());
				return { name, type: type || "string" };
			});

			const language = await vscode.window.showQuickPick(["JavaScript", "TypeScript"], {
				placeHolder: "Select project language",
			});
			if (!language) {
				vscode.window.showErrorMessage("Language selection is required!");
				return;
			}

			const database = await vscode.window.showQuickPick(["MongoDB", "MySQL", "PostgreSQL"], {
				placeHolder: "Select the database",
			});
			if (!database) {
				vscode.window.showErrorMessage("Database selection is required!");
				return;
			}

			const dblink = await vscode.window.showInputBox({
				placeHolder:
					database === "MongoDB"
						? "mongodb://localhost:27017/mydb"
						: database === "MySQL"
						? "mysql://user:password@localhost:3306/mydb"
						: "postgresql://user:password@localhost:5432/mydb",
				prompt: "Enter your database connection string",
			});
			if (!dblink) {
				vscode.window.showErrorMessage("Database connection string is required!");
				return;
			}

			const port = (await vscode.window.showInputBox({
				placeHolder: "3000",
				prompt: "Enter server port number",
				value: "3000",
			})) || "3000";

			const structureChoice = await vscode.window.showQuickPick(
				["Simple (flat folders)", "Advanced (src/ layout)", "Clean Architecture"],
				{ placeHolder: "Select folder structure" }
			);
			if (!structureChoice) { return; }
			const structureKey = structureChoice.startsWith("Advanced") ? "advanced" : structureChoice.startsWith("Clean") ? "clean" : "simple";

			// ── 2. Derived values ──────────────────────────────────────────────

			const ModuleName = capitalize(moduleName);
			const exe = language === "TypeScript" ? "ts" : "js";
			const db =
				database === "MongoDB" ? "mongoose" : database === "MySQL" ? "mysql2" : "pg";
			const layout = getStructureLayout(structureKey);

			const rootPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
			if (!rootPath) {
				vscode.window.showErrorMessage("Open a project folder first!");
				return;
			}

			// ── 3. Setup & install deps ────────────────────────────────────────

			await vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.Notification,
					title: "Generating Node.js backend...",
					cancellable: false,
				},
				async (progress) => {
					// Step 1: package.json
					progress.report({ increment: 5, message: "Initializing package.json..." });
					const packageJsonPath = path.join(rootPath, "package.json");
					if (!fs.existsSync(packageJsonPath)) {
						await runCommand("npm init -y", rootPath);
					}

					// Make sure "type": "module" is NOT set and esm is handled via ts/commonjs
					const pkgJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
					pkgJson.main = exe === "ts" ? "dist/server.js" : "server.js";
					pkgJson.scripts = {
						...(pkgJson.scripts || {}),
						start:
							language === "TypeScript"
								? "node dist/server.js"
								: "node server.js",
						dev:
							language === "TypeScript"
								? "ts-node server.ts"
								: "nodemon server.js",
						build: language === "TypeScript" ? "tsc" : undefined,
					};
					// Remove undefined keys
					Object.keys(pkgJson.scripts).forEach(
						(k) => pkgJson.scripts[k] === undefined && delete pkgJson.scripts[k]
					);
					fs.writeFileSync(packageJsonPath, JSON.stringify(pkgJson, null, 2));

					// Step 2: Install runtime deps
					progress.report({ increment: 10, message: "Installing dependencies..." });
					const runtimeDeps = ["express", "cors", "dotenv", "bcryptjs", "jsonwebtoken", db];
					await runCommand(`npm install ${runtimeDeps.join(" ")}`, rootPath);

					// Step 3: Install dev deps
					progress.report({ increment: 20, message: "Installing dev dependencies..." });
					let devDeps = ["nodemon"];
					if (language === "TypeScript") {
						devDeps = devDeps.concat([
							"typescript",
							"ts-node",
							"@types/node",
							"@types/express",
							"@types/cors",
							"@types/bcryptjs",
							"@types/jsonwebtoken",
						]);
					}
					await runCommand(`npm install --save-dev ${devDeps.join(" ")}`, rootPath);

					// Step 4: Create folder structure
					progress.report({ increment: 10, message: "Creating folder structure..." });
					layout.folders.forEach((folder) => {
						const fp = path.join(rootPath, folder);
						if (!fs.existsSync(fp)) { fs.mkdirSync(fp, { recursive: true }); }
					});

					// Step 5: tsconfig.json
					if (language === "TypeScript") {
						progress.report({ increment: 5, message: "Generating tsconfig.json..." });
						const tscPath = path.join(rootPath, "tsconfig.json");
						if (!fs.existsSync(tscPath)) {
							fs.writeFileSync(tscPath, generateTsConfig());
						}
					}

					// Step 6: .env
					progress.report({ increment: 5, message: "Generating .env..." });
					fs.writeFileSync(path.join(rootPath, ".env"), generateEnv(port, db, dblink));

					// .env.example
					fs.writeFileSync(
						path.join(rootPath, ".env.example"),
						`PORT=${port}\n${dblink}\n`
					);

					// .gitignore
					const gitignorePath = path.join(rootPath, ".gitignore");
					if (!fs.existsSync(gitignorePath)) {
						fs.writeFileSync(gitignorePath, "node_modules/\n.env\ndist/\n");
					}

					// Step 7: DB connection file
					progress.report({ increment: 10, message: "Generating DB connection..." });
					fs.writeFileSync(
						path.join(rootPath, layout.dbDir, `db.${exe}`),
						generateDbFile(db, exe)
					);

					// Step 8: Model
					progress.report({ increment: 10, message: "Generating model..." });
					fs.writeFileSync(
						path.join(rootPath, layout.modelsDir, `${ModuleName}.${exe}`),
						generateModel(ModuleName, fields, db, exe, layout.dbImportInController)
					);

					// Step 9: Controller
					progress.report({ increment: 10, message: "Generating controller..." });
					const controllerContent =
						db === "mongoose"
							? generateMongooseController(ModuleName, moduleName, exe, layout.modelImportInController)
							: generateSqlController(ModuleName, moduleName, fields, db, exe, layout.modelImportInController);
					fs.writeFileSync(
						path.join(rootPath, layout.controllersDir, `${ModuleName}.controller.${exe}`),
						controllerContent
					);

					// Step 10: Routes
					progress.report({ increment: 10, message: "Generating routes..." });
					fs.writeFileSync(
						path.join(rootPath, layout.routesDir, `${ModuleName}.routes.${exe}`),
						generateRoutes(ModuleName, exe, layout.controllerImportInRoute)
					);

					// Step 11: Server
					progress.report({ increment: 10, message: "Generating server..." });
					fs.writeFileSync(
						path.join(rootPath, `server.${exe}`),
						generateServer(ModuleName, moduleName, port, db, exe, layout)
					);

					progress.report({ increment: 5, message: "Done!" });
				}
			);

			vscode.window.showInformationMessage(
				`✅ ${ModuleName} module generated! Run "npm run dev" to start the server on port ${port}.`
			);
		}
	);

	context.subscriptions.push(disposable);

	// ─── Auth Generator Command ───────────────────────────────────────────────

	const authDisposable = vscode.commands.registerCommand(
		"my-first-extension.generateAuth",
		async () => {
			const rootPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
			if (!rootPath) {
				vscode.window.showErrorMessage("Open a project folder first!");
				return;
			}

			const language = await vscode.window.showQuickPick(["TypeScript", "JavaScript"], {
				placeHolder: "Select language for auth module",
			});
			if (!language) { return; }

			const database = await vscode.window.showQuickPick(["MongoDB", "MySQL", "PostgreSQL"], {
				placeHolder: "Select database for auth module",
			});
			if (!database) { return; }

			const exe = language === "TypeScript" ? "ts" : "js";
			const db  = database === "MongoDB" ? "mongoose" : database === "MySQL" ? "mysql2" : "pg";

			await vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.Notification,
					title: "Generating Auth Module...",
					cancellable: false,
				},
				async (progress) => {
					// Ensure folders exist
					progress.report({ increment: 10, message: "Creating folders..." });
					["middleware", "controllers", "routes", "models"].forEach((f) => {
						const fp = path.join(rootPath, f);
						if (!fs.existsSync(fp)) { fs.mkdirSync(fp, { recursive: true }); }
					});

					// Install auth deps — create package.json first if missing
					const pkgPath = path.join(rootPath, "package.json");
					progress.report({ increment: 20, message: "Installing auth dependencies..." });
					if (!fs.existsSync(pkgPath)) {
						await runCommand("npm init -y", rootPath);
					}
					await runCommand(`npm install bcryptjs jsonwebtoken dotenv ${db} express cors`, rootPath);
					if (language === "TypeScript") {
						await runCommand("npm install --save-dev @types/bcryptjs @types/jsonwebtoken @types/node @types/express @types/cors typescript ts-node", rootPath);
					}

					// JWT middleware
					progress.report({ increment: 20, message: "Writing middleware..." });
					fs.writeFileSync(
						path.join(rootPath, "middleware", `auth.middleware.${exe}`),
						generateAuthMiddleware(exe)
					);

					// User model
					progress.report({ increment: 15, message: "Writing User model..." });
					fs.writeFileSync(
						path.join(rootPath, "models", `User.${exe}`),
						generateUserModel(exe, db, "../DB/db")
					);

					// Auth controller
					progress.report({ increment: 15, message: "Writing auth controller..." });
					fs.writeFileSync(
						path.join(rootPath, "controllers", `auth.controller.${exe}`),
						generateAuthController(exe, db)
					);

					// Auth routes
					progress.report({ increment: 15, message: "Writing auth routes..." });
					fs.writeFileSync(
						path.join(rootPath, "routes", `auth.routes.${exe}`),
						generateAuthRoutes(exe)
					);

					// Ensure JWT_SECRET is in .env
					const envPath = path.join(rootPath, ".env");
					const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
					if (!envContent.includes("JWT_SECRET")) {
						fs.appendFileSync(envPath, "\nJWT_SECRET=your_super_secret_key_here\nJWT_EXPIRES_IN=7d\n");
					}

					progress.report({ increment: 5, message: "Done!" });
				}
			);

			vscode.window.showInformationMessage(
				"🔐 Auth module generated! Mount routes: app.use('/api/auth', authRouter)"
			);
		}
	);

	// ─── Sidebar Webview ──────────────────────────────────────────────────────

	const sidebarProvider = new BackendGeneratorSidebarProvider(context.extensionUri, context);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			BackendGeneratorSidebarProvider.viewId,
			sidebarProvider
		)
	);

	// ─── Sidebar-driven: Generate Module (values come from the form) ──────────

	const sidebarModuleDisposable = vscode.commands.registerCommand(
		"my-first-extension.generateMernModuleFromSidebar",
		async (msg: { moduleName: string; fields: string; language: string; database: string; dblink: string; port: string; structure: string }) => {
			console.log("[BackendGen] generateMernModuleFromSidebar called", msg);
			vscode.window.showInformationMessage(`Extension: Generating ${msg.language} module with ${msg.database}`);

			const rootPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
			if (!rootPath) {
				vscode.window.showErrorMessage("BackendGen: No folder open. Please open a folder first!");
				sidebarProvider.postStatus("No folder open — use File → Open Folder first!", "error");
				return;
			}
			console.log("[BackendGen] rootPath =", rootPath);
			sidebarProvider.postStatus(`Generating in: ${rootPath}`, "info");

			const { moduleName, fields: fieldInput, language, database, dblink, port, structure = "simple" } = msg;
			const ModuleName = capitalize(moduleName);
			const exe = language === "TypeScript" ? "ts" : "js";
			const db = database === "MongoDB" ? "mongoose" : database === "MySQL" ? "mysql2" : "pg";
			const fields = fieldInput.split(",").map((f) => {
				const [name, type] = f.split(":").map((p) => p.trim());
				return { name, type: type || "string" };
			});
			const layout = getStructureLayout(structure);

			try {
				// ── Step 1: package.json ────────────────────────────────────────
				sidebarProvider.postStatus("Creating project structure...", "info");
				const packageJsonPath = path.join(rootPath, "package.json");
				let pkgJson: Record<string, any> = {};
				if (fs.existsSync(packageJsonPath)) {
					try { pkgJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")); } catch { pkgJson = {}; }
				}
				const folderName = path.basename(rootPath);
				pkgJson.name = pkgJson.name || folderName.toLowerCase().replace(/\s+/g, "-");
				pkgJson.version = pkgJson.version || "1.0.0";
				pkgJson.description = pkgJson.description || "";
				pkgJson.main = exe === "ts" ? "dist/server.js" : "server.js";
				pkgJson.scripts = {
					...(pkgJson.scripts || {}),
					start: language === "TypeScript" ? "node dist/server.js" : "node server.js",
					dev:   language === "TypeScript" ? "ts-node server.ts" : "nodemon server.js",
					...(language === "TypeScript" ? { build: "tsc" } : {}),
				};
				fs.writeFileSync(packageJsonPath, JSON.stringify(pkgJson, null, 2));

				// ── Step 2: Folders ────────────────────────────────────────────
				layout.folders.forEach((folder) => {
					const fp = path.join(rootPath, folder);
					if (!fs.existsSync(fp)) { fs.mkdirSync(fp, { recursive: true }); }
				});

				// ── Step 3: Config files ───────────────────────────────────────
				if (language === "TypeScript" && !fs.existsSync(path.join(rootPath, "tsconfig.json"))) {
					fs.writeFileSync(path.join(rootPath, "tsconfig.json"), generateTsConfig());
				}
				fs.writeFileSync(path.join(rootPath, ".env"), generateEnv(port, db, dblink));
				fs.writeFileSync(path.join(rootPath, ".env.example"), `PORT=${port}\nDB_URI=your_connection_string_here\n`);
				if (!fs.existsSync(path.join(rootPath, ".gitignore"))) {
					fs.writeFileSync(path.join(rootPath, ".gitignore"), "node_modules/\n.env\ndist/\n");
				}

				// ── Step 4: Source files ───────────────────────────────────────
				sidebarProvider.postStatus("Writing source files...", "info");
				fs.writeFileSync(path.join(rootPath, layout.dbDir, `db.${exe}`), generateDbFile(db, exe));
				fs.writeFileSync(path.join(rootPath, layout.modelsDir, `${ModuleName}.${exe}`), generateModel(ModuleName, fields, db, exe, layout.dbImportInController));
				const ctrl = db === "mongoose"
					? generateMongooseController(ModuleName, moduleName, exe, layout.modelImportInController)
					: generateSqlController(ModuleName, moduleName, fields, db, exe, layout.modelImportInController);
				fs.writeFileSync(path.join(rootPath, layout.controllersDir, `${ModuleName}.controller.${exe}`), ctrl);
				fs.writeFileSync(path.join(rootPath, layout.routesDir, `${ModuleName}.routes.${exe}`), generateRoutes(ModuleName, exe, layout.controllerImportInRoute));
				fs.writeFileSync(path.join(rootPath, `server.${exe}`), generateServer(ModuleName, moduleName, port, db, exe, layout));

				sidebarProvider.postStatus("Files written! Installing dependencies in terminal...", "info");

				// ── Step 5: npm install in a visible terminal ──────────────────
				const runtimeDeps = ["express", "cors", "dotenv", "bcryptjs", "jsonwebtoken", db];
				let devDeps = ["nodemon"];
				if (language === "TypeScript") {
					devDeps = devDeps.concat(["typescript", "ts-node", "@types/node", "@types/express", "@types/cors", "@types/bcryptjs", "@types/jsonwebtoken"]);
				}

				const terminal = vscode.window.createTerminal({
					name: `Backend Gen — ${ModuleName}`,
					cwd: rootPath,
				});
				terminal.show(true);
				terminal.sendText(`npm install ${runtimeDeps.join(" ")} && npm install --save-dev ${devDeps.join(" ")} && echo "✅ Dependencies installed! Run: npm run dev"`);

				sidebarProvider.postStatus(`✓ ${ModuleName} module files generated! See terminal for npm install progress. Run "npm run dev" once done.`, "success");
				sidebarProvider.postBackendGenerated();
				vscode.window.showInformationMessage(`Successfully generated ${ModuleName} module files! Check the terminal down below.`);
				console.log("[BackendGen] Done — terminal opened for npm install");
			} catch (err) {
				console.error("[BackendGen] Error:", err);
				const errorMsg = (err as Error).message || String(err);
				vscode.window.showErrorMessage(`BackendGen Error: ${errorMsg}`);
				sidebarProvider.postStatus(`Error: ${errorMsg}`, "error");
			}
		}
	);

	// ─── Sidebar-driven: Generate Auth (values come from the form) ────────────

	const sidebarAuthDisposable = vscode.commands.registerCommand(
		"my-first-extension.generateAuthFromSidebar",
		async (msg: { language: string }) => {
			console.log("[BackendGen] generateAuthFromSidebar called", msg);
			vscode.window.showInformationMessage(`Extension: Generating ${msg.language} Auth`);

			const rootPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
			if (!rootPath) {
				vscode.window.showErrorMessage("BackendGen: No folder open. Please open a folder first!");
				sidebarProvider.postStatus("No folder open — use File → Open Folder first!", "error");
				return;
			}

			const { language } = msg;
			const exe = language === "TypeScript" ? "ts" : "js";
			const { db, layout } = detectProjectConfig(rootPath);

			try {
				// ── Folders ────────────────────────────────────────────────────
				layout.folders.forEach((f) => {
					const fp = path.join(rootPath, f);
					if (!fs.existsSync(fp)) { fs.mkdirSync(fp, { recursive: true }); }
				});

				// ── package.json ───────────────────────────────────────────────
				const pkgPath = path.join(rootPath, "package.json");
				if (!fs.existsSync(pkgPath)) {
					const folderName = path.basename(rootPath);
					const defaultPkg = { name: folderName.toLowerCase().replace(/\s+/g, "-"), version: "1.0.0", description: "", main: "server.js", scripts: { start: "node server.js", dev: "nodemon server.js" } };
					fs.writeFileSync(pkgPath, JSON.stringify(defaultPkg, null, 2));
				}

				// ── Write auth files immediately ───────────────────────────────
				sidebarProvider.postStatus("Writing auth files...", "info");
				fs.writeFileSync(path.join(rootPath, layout.middlewareDir,  `auth.middleware.${exe}`), generateAuthMiddleware(exe));
				fs.writeFileSync(path.join(rootPath, layout.modelsDir,      `User.${exe}`),            generateUserModel(exe, db, layout.dbImportInController));
				fs.writeFileSync(path.join(rootPath, layout.controllersDir, `auth.controller.${exe}`), generateAuthController(exe, db, layout.userModelImportInAuthController));
				fs.writeFileSync(path.join(rootPath, layout.routesDir,      `auth.routes.${exe}`),     generateAuthRoutes(exe, layout.authControllerImportInAuthRoute, layout.authMiddlewareImportInAuthRoute));

				const envPath = path.join(rootPath, ".env");
				const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
				if (!envContent.includes("JWT_SECRET")) {
					fs.appendFileSync(envPath, "\nJWT_SECRET=your_super_secret_key_here\nJWT_EXPIRES_IN=7d\n");
				}

				// ── npm install in visible terminal ────────────────────────────
				sidebarProvider.postStatus("Files written! Installing dependencies in terminal...", "info");
				const runtimeDeps = `bcryptjs jsonwebtoken dotenv ${db} express cors`;
				const devDeps = language === "TypeScript"
					? "@types/bcryptjs @types/jsonwebtoken @types/node @types/express @types/cors typescript ts-node"
					: "";

				const terminal = vscode.window.createTerminal({
					name: "Backend Gen — Auth",
					cwd: rootPath,
				});
				terminal.show(true);
				const installCmd = devDeps
					? `npm install ${runtimeDeps} && npm install --save-dev ${devDeps} && echo "✅ Auth dependencies installed!"`
					: `npm install ${runtimeDeps} && echo "✅ Auth dependencies installed!"`;
				terminal.sendText(installCmd);

				sidebarProvider.postStatus("✓ Auth files generated! See terminal for npm install. Mount: app.use('/api/auth', authRouter)", "success");
				vscode.window.showInformationMessage("Auth generated! Check terminal.");
				console.log("[BackendGen] Auth done — terminal opened");
			} catch (err) {
				console.error("[BackendGen] Auth error:", err);
				const errorMsg = (err as Error).message || String(err);
				vscode.window.showErrorMessage(`BackendGen Auth Error: ${errorMsg}`);
				sidebarProvider.postStatus(`Error: ${errorMsg}`, "error");
			}
		}
	);

	const openSidebarDisposable = vscode.commands.registerCommand(
		"my-first-extension.openSidebar",
		() => {
			vscode.commands.executeCommand("backendGeneratorSidebar.focus");
		}
	);

	// ─── Sidebar-driven: Generate Full Backend ────────────────────────────────

	const fullBackendDisposable = vscode.commands.registerCommand(
		"my-first-extension.generateFullBackendFromSidebar",
		async (msg: { moduleName: string; fields: string; language: string; database: string; dblink: string; port: string }) => {
			console.log("[BackendGen] generateFullBackendFromSidebar called", msg);
			vscode.window.showInformationMessage("Backend Generator: Building full Advanced-structure backend...");

			const rootPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
			if (!rootPath) {
				vscode.window.showErrorMessage("BackendGen: No folder open. Please open a folder first!");
				sidebarProvider.postStatus("No folder open — use File → Open Folder first!", "error");
				return;
			}

			const { moduleName, fields: fieldInput, language, database, dblink, port } = msg;
			const ModuleName = capitalize(moduleName);
			const exe = language === "TypeScript" ? "ts" : "js";
			const db = database === "MongoDB" ? "mongoose" : database === "MySQL" ? "mysql2" : "pg";
			const fields = fieldInput.split(",").map((f) => {
				const [name, type] = f.split(":").map((p) => p.trim());
				return { name, type: type || "string" };
			});
			const layout = getStructureLayout("advanced");

			try {
				sidebarProvider.postStatus("Creating Advanced project structure...", "info");

				// ── package.json ──────────────────────────────────────────────
				const packageJsonPath = path.join(rootPath, "package.json");
				let pkgJson: Record<string, any> = {};
				if (fs.existsSync(packageJsonPath)) {
					try { pkgJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")); } catch { pkgJson = {}; }
				}
				const folderName = path.basename(rootPath);
				pkgJson.name = pkgJson.name || folderName.toLowerCase().replace(/\s+/g, "-");
				pkgJson.version = pkgJson.version || "1.0.0";
				pkgJson.description = pkgJson.description || "";
				pkgJson.main = exe === "ts" ? "dist/server.js" : "server.js";
				pkgJson.scripts = {
					...(pkgJson.scripts || {}),
					start: language === "TypeScript" ? "node dist/server.js" : "node server.js",
					dev:   language === "TypeScript" ? "ts-node server.ts" : "nodemon server.js",
					...(language === "TypeScript" ? { build: "tsc" } : {}),
				};
				fs.writeFileSync(packageJsonPath, JSON.stringify(pkgJson, null, 2));

				// ── Folders ───────────────────────────────────────────────────
				layout.folders.forEach((folder) => {
					const fp = path.join(rootPath, folder);
					if (!fs.existsSync(fp)) { fs.mkdirSync(fp, { recursive: true }); }
				});

				// ── Config files ──────────────────────────────────────────────
				if (language === "TypeScript" && !fs.existsSync(path.join(rootPath, "tsconfig.json"))) {
					fs.writeFileSync(path.join(rootPath, "tsconfig.json"), generateTsConfig());
				}
				fs.writeFileSync(path.join(rootPath, ".env"), generateEnv(port, db, dblink));
				fs.writeFileSync(path.join(rootPath, ".env.example"), `PORT=${port}\nDB_URI=${dblink}\nJWT_SECRET=your_super_secret_key_here\nJWT_EXPIRES_IN=7d\n`);
				if (!fs.existsSync(path.join(rootPath, ".gitignore"))) {
					fs.writeFileSync(path.join(rootPath, ".gitignore"), "node_modules/\n.env\ndist/\n");
				}

				// Append JWT secrets to .env if missing
				const envContent = fs.readFileSync(path.join(rootPath, ".env"), "utf8");
				if (!envContent.includes("JWT_SECRET")) {
					fs.appendFileSync(path.join(rootPath, ".env"), "\nJWT_SECRET=your_super_secret_key_here\nJWT_EXPIRES_IN=7d\n");
				}

				// ── Module files ──────────────────────────────────────────────
				sidebarProvider.postStatus("Writing module files...", "info");
				fs.writeFileSync(path.join(rootPath, layout.dbDir, `db.${exe}`), generateDbFile(db, exe));
				fs.writeFileSync(path.join(rootPath, layout.modelsDir, `${ModuleName}.${exe}`), generateModel(ModuleName, fields, db, exe, layout.dbImportInController));
				const ctrl = db === "mongoose"
					? generateMongooseController(ModuleName, moduleName, exe, layout.modelImportInController)
					: generateSqlController(ModuleName, moduleName, fields, db, exe, layout.modelImportInController);
				fs.writeFileSync(path.join(rootPath, layout.controllersDir, `${ModuleName}.controller.${exe}`), ctrl);
				fs.writeFileSync(path.join(rootPath, layout.routesDir, `${ModuleName}.routes.${exe}`), generateRoutes(ModuleName, exe, layout.controllerImportInRoute));

				// ── Auth files ────────────────────────────────────────────────
				sidebarProvider.postStatus("Writing auth files...", "info");
				fs.writeFileSync(path.join(rootPath, layout.middlewareDir, `auth.middleware.${exe}`), generateAuthMiddleware(exe));
				fs.writeFileSync(path.join(rootPath, layout.modelsDir, `User.${exe}`), generateUserModel(exe, db, layout.dbImportInController));
				fs.writeFileSync(path.join(rootPath, layout.controllersDir, `auth.controller.${exe}`), generateAuthController(exe, db, layout.userModelImportInAuthController));
				fs.writeFileSync(path.join(rootPath, layout.routesDir, `auth.routes.${exe}`), generateAuthRoutes(exe, layout.authControllerImportInAuthRoute, layout.authMiddlewareImportInAuthRoute));

				// ── Server ────────────────────────────────────────────────────
				sidebarProvider.postStatus("Writing server file...", "info");
				fs.writeFileSync(path.join(rootPath, `server.${exe}`), generateServer(ModuleName, moduleName, port, db, exe, layout));

				sidebarProvider.postStatus("Files written! Installing dependencies...", "info");

				// ── npm install ───────────────────────────────────────────────
				const runtimeDeps = ["express", "cors", "dotenv", "bcryptjs", "jsonwebtoken", db];
				let devDeps = ["nodemon"];
				if (language === "TypeScript") {
					devDeps = devDeps.concat(["typescript", "ts-node", "@types/node", "@types/express", "@types/cors", "@types/bcryptjs", "@types/jsonwebtoken"]);
				}
				const terminal = vscode.window.createTerminal({
					name: "Backend Gen — Full Backend",
					cwd: rootPath,
				});
				terminal.show(true);
				terminal.sendText(`npm install ${runtimeDeps.join(" ")} && npm install --save-dev ${devDeps.join(" ")} && echo "✅ Full backend ready! Run: npm run dev"`);

				sidebarProvider.postStatus(`✓ Full backend generated with Advanced structure! Module + Auth + Server. Run "npm run dev" after install.`, "success");
				sidebarProvider.postBackendGenerated();
				vscode.window.showInformationMessage(`🚀 Full backend (Advanced) generated for ${ModuleName}!`);
			} catch (err) {
				console.error("[BackendGen] Full backend error:", err);
				const errorMsg = (err as Error).message || String(err);
				vscode.window.showErrorMessage(`BackendGen Error: ${errorMsg}`);
				sidebarProvider.postStatus(`Error: ${errorMsg}`, "error");
			}
		}
	);

	// ─── Sidebar-driven: Add Module to existing backend ──────────────────────

	const addModuleDisposable = vscode.commands.registerCommand(
		"my-first-extension.addModuleToBackend",
		async (msg: { moduleName: string; fields: string }) => {
			console.log("[BackendGen] addModuleToBackend called", msg);

			const rootPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
			if (!rootPath) {
				vscode.window.showErrorMessage("BackendGen: No folder open!");
				sidebarProvider.postStatus("No folder open — use File → Open Folder first!", "error");
				return;
			}

			const { moduleName, fields: fieldInput } = msg;
			if (!/^[A-Za-z][A-Za-z0-9]*$/.test(moduleName)) {
				sidebarProvider.postStatus("Module name must start with a letter and contain only letters and digits (e.g. Product).", "error");
				return;
			}
			const ModuleName = capitalize(moduleName);
			const fields = fieldInput.split(",").map((f) => {
				const [name, type] = f.split(":").map((p) => p.trim());
				return { name, type: type || "string" };
			});

			try {
				sidebarProvider.postStatus(`Detecting existing project config...`, "info");
				const { exe, db, layout } = detectProjectConfig(rootPath);
				sidebarProvider.postStatus(`Detected: ${exe === "ts" ? "TypeScript" : "JavaScript"}, ${db}, ${layout.modelsDir.startsWith("src/presentation") ? "Clean" : layout.modelsDir.startsWith("src/") ? "Advanced" : "Simple"} structure`, "info");

				// Ensure target folders exist
				[layout.modelsDir, layout.controllersDir, layout.routesDir].forEach((dir) => {
					const fp = path.join(rootPath, dir);
					if (!fs.existsSync(fp)) { fs.mkdirSync(fp, { recursive: true }); }
				});

				// Model
				fs.writeFileSync(
					path.join(rootPath, layout.modelsDir, `${ModuleName}.${exe}`),
					generateModel(ModuleName, fields, db, exe, layout.dbImportInController)
				);

				// Controller
				const ctrl = db === "mongoose"
					? generateMongooseController(ModuleName, moduleName, exe, layout.modelImportInController)
					: generateSqlController(ModuleName, moduleName, fields, db, exe, layout.modelImportInController);
				fs.writeFileSync(path.join(rootPath, layout.controllersDir, `${ModuleName}.controller.${exe}`), ctrl);

				// Routes
				fs.writeFileSync(
					path.join(rootPath, layout.routesDir, `${ModuleName}.routes.${exe}`),
					generateRoutes(ModuleName, exe, layout.controllerImportInRoute)
				);

				// Update server file
				const serverPath = path.join(rootPath, `server.${exe}`);
				if (fs.existsSync(serverPath)) {
					const serverContent = fs.readFileSync(serverPath, "utf8");
					const updated = updateServerFile(serverContent, ModuleName, moduleName, exe, layout, db);
					fs.writeFileSync(serverPath, updated);
					sidebarProvider.postStatus(`server.${exe} updated with new route and model initialization.`, "info");
				} else {
					sidebarProvider.postStatus(`Warning: server.${exe} not found — skipped server update.`, "info");
				}

				sidebarProvider.postStatus(`✓ Module ${ModuleName} added! model, controller, routes created and server updated.`, "success");
				vscode.window.showInformationMessage(`✅ Module ${ModuleName} added to your backend!`);
			} catch (err) {
				console.error("[BackendGen] addModule error:", err);
				const errorMsg = (err as Error).message || String(err);
				vscode.window.showErrorMessage(`BackendGen Error: ${errorMsg}`);
				sidebarProvider.postStatus(`Error: ${errorMsg}`, "error");
			}
		}
	);

	context.subscriptions.push(authDisposable, sidebarModuleDisposable, sidebarAuthDisposable, openSidebarDisposable, fullBackendDisposable, addModuleDisposable);
}

// ─── Auth file generators ─────────────────────────────────────────────────────

function generateAuthMiddleware(exe: string): string {
	return exe === "ts"
		? `import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

export interface AuthRequest extends Request {
  user?: any;
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: 'No token provided' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};
`
		: `const jwt = require('jsonwebtoken');
require('dotenv').config();

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};
`;
}

function generateUserModel(exe: string, db = "mongoose", dbImport = "../DB/db"): string {
	if (db === "mongoose") {
		return exe === "ts"
			? `import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends mongoose.Document {
  name: string;
  email: string;
  password: string;
  comparePassword(candidate: string): Promise<boolean>;
}

const UserSchema = new mongoose.Schema<IUser>(
  {
    name:     { type: String, required: true },
    email:    { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true, minlength: 6 },
  },
  { timestamps: true }
);

UserSchema.pre('save', async function () {
  if (!this.isModified('password')) { return; }
  this.password = await bcrypt.hash(this.password, 10);
});

UserSchema.methods.comparePassword = function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

export default mongoose.model<IUser>('User', UserSchema);
`
			: `const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema(
  {
    name:     { type: String, required: true },
    email:    { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true, minlength: 6 },
  },
  { timestamps: true }
);

UserSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

UserSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', UserSchema);
`;
	}

	if (db === "mysql2") {
		return exe === "ts"
			? `import pool from '${dbImport}';
import bcrypt from 'bcryptjs';

export interface IUser {
  id: number;
  name: string;
  email: string;
  password: string;
}

export const initUsersTable = async (): Promise<void> => {
  await pool.execute(\`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  \`);
};

export const User = {
  async findByEmail(email: string): Promise<IUser | null> {
    const [rows] = await pool.execute<any[]>('SELECT * FROM users WHERE email = ?', [email]);
    return rows[0] ?? null;
  },
  async create(name: string, email: string, password: string): Promise<IUser> {
    const hashed = await bcrypt.hash(password, 10);
    const [result] = await pool.execute<any>(
      'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
      [name, email, hashed]
    );
    return { id: result.insertId, name, email, password: hashed };
  },
  async findById(id: number): Promise<Omit<IUser, 'password'> | null> {
    const [rows] = await pool.execute<any[]>('SELECT id, name, email, created_at FROM users WHERE id = ?', [id]);
    return rows[0] ?? null;
  },
  async comparePassword(candidate: string, hashed: string): Promise<boolean> {
    return bcrypt.compare(candidate, hashed);
  },
};

initUsersTable().catch(console.error);
`
			: `const bcrypt = require('bcryptjs');
const pool = require('${dbImport}');

const initUsersTable = async () => {
  await pool.execute(\`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  \`);
};

const User = {
  async findByEmail(email) {
    const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
    return rows[0] ?? null;
  },
  async create(name, email, password) {
    const hashed = await bcrypt.hash(password, 10);
    const [result] = await pool.execute(
      'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
      [name, email, hashed]
    );
    return { id: result.insertId, name, email };
  },
  async findById(id) {
    const [rows] = await pool.execute('SELECT id, name, email, created_at FROM users WHERE id = ?', [id]);
    return rows[0] ?? null;
  },
  async comparePassword(candidate, hashed) {
    return bcrypt.compare(candidate, hashed);
  },
};

initUsersTable().catch(console.error);
module.exports = { User, initUsersTable };
`;
	}

	// PostgreSQL
	return exe === "ts"
		? `import pool from '${dbImport}';
import bcrypt from 'bcryptjs';

export interface IUser {
  id: number;
  name: string;
  email: string;
  password: string;
}

export const initUsersTable = async (): Promise<void> => {
  await pool.query(\`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  \`);
};

export const User = {
  async findByEmail(email: string): Promise<IUser | null> {
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    return rows[0] ?? null;
  },
  async create(name: string, email: string, password: string): Promise<IUser> {
    const hashed = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email',
      [name, email, hashed]
    );
    return rows[0];
  },
  async findById(id: number): Promise<Omit<IUser, 'password'> | null> {
    const { rows } = await pool.query('SELECT id, name, email, created_at FROM users WHERE id = $1', [id]);
    return rows[0] ?? null;
  },
  async comparePassword(candidate: string, hashed: string): Promise<boolean> {
    return bcrypt.compare(candidate, hashed);
  },
};

initUsersTable().catch(console.error);
`
		: `const bcrypt = require('bcryptjs');
const pool = require('${dbImport}');

const initUsersTable = async () => {
  await pool.query(\`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  \`);
};

const User = {
  async findByEmail(email) {
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    return rows[0] ?? null;
  },
  async create(name, email, password) {
    const hashed = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email',
      [name, email, hashed]
    );
    return rows[0];
  },
  async findById(id) {
    const { rows } = await pool.query('SELECT id, name, email, created_at FROM users WHERE id = $1', [id]);
    return rows[0] ?? null;
  },
  async comparePassword(candidate, hashed) {
    return bcrypt.compare(candidate, hashed);
  },
};

initUsersTable().catch(console.error);
module.exports = { User, initUsersTable };
`;
}

function generateAuthController(exe: string, db = "mongoose", userModelImport = "../models/User"): string {
	const isSql = db !== "mongoose";
	if (!isSql) {
		// Mongoose version
		return exe === "ts"
			? `import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import User from '${userModelImport}';
dotenv.config();

const signToken = (id: unknown): string =>
  jwt.sign({ id: String(id) }, process.env.JWT_SECRET as string, {
    expiresIn: (process.env.JWT_EXPIRES_IN ?? '7d') as '7d',
  });

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password } = req.body;
    const existing = await User.findOne({ email });
    if (existing) { res.status(409).json({ message: 'Email already in use' }); return; }
    const user = await User.create({ name, email, password });
    const token = signToken(user._id);
    res.status(201).json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ message: 'Registration failed', error: (err as Error).message });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      res.status(401).json({ message: 'Invalid email or password' });
      return;
    }
    const token = signToken(user._id);
    res.status(200).json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ message: 'Login failed', error: (err as Error).message });
  }
};

export const getMe = async (req: any, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) { res.status(404).json({ message: 'User not found' }); return; }
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ message: 'Failed to get user', error: (err as Error).message });
  }
};
`
			: `const jwt = require('jsonwebtoken');
const User = require('${userModelImport}');
require('dotenv').config();

const signToken = (id) =>
  jwt.sign({ id: String(id) }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ message: 'Email already in use' });
    const user = await User.create({ name, email, password });
    const token = signToken(user._id);
    res.status(201).json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ message: 'Registration failed', error: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    const token = signToken(user._id);
    res.status(200).json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ message: 'Login failed', error: err.message });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ message: 'Failed to get user', error: err.message });
  }
};
`;
	}

	// SQL version (mysql2 or pg)
	return exe === "ts"
		? `import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { User } from '${userModelImport}';
dotenv.config();

const signToken = (id: unknown): string =>
  jwt.sign({ id: String(id) }, process.env.JWT_SECRET as string, {
    expiresIn: (process.env.JWT_EXPIRES_IN ?? '7d') as '7d',
  });

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password } = req.body;
    const existing = await User.findByEmail(email);
    if (existing) { res.status(409).json({ message: 'Email already in use' }); return; }
    const user = await User.create(name, email, password);
    const token = signToken(user.id);
    res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ message: 'Registration failed', error: (err as Error).message });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    const user = await User.findByEmail(email);
    if (!user || !(await User.comparePassword(password, user.password))) {
      res.status(401).json({ message: 'Invalid email or password' });
      return;
    }
    const token = signToken(user.id);
    res.status(200).json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ message: 'Login failed', error: (err as Error).message });
  }
};

export const getMe = async (req: any, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) { res.status(404).json({ message: 'User not found' }); return; }
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ message: 'Failed to get user', error: (err as Error).message });
  }
};
`
		: `const jwt = require('jsonwebtoken');
const { User } = require('${userModelImport}');
require('dotenv').config();

const signToken = (id) =>
  jwt.sign({ id: String(id) }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const existing = await User.findByEmail(email);
    if (existing) return res.status(409).json({ message: 'Email already in use' });
    const user = await User.create(name, email, password);
    const token = signToken(user.id);
    res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ message: 'Registration failed', error: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findByEmail(email);
    if (!user || !(await User.comparePassword(password, user.password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    const token = signToken(user.id);
    res.status(200).json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ message: 'Login failed', error: err.message });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ message: 'Failed to get user', error: err.message });
  }
};
`;
}

function generateAuthRoutes(exe: string, ctrlImport = "../controllers/auth.controller", mwImport = "../middleware/auth.middleware"): string {
	return exe === "ts"
		? `import { Router } from 'express';
import { register, login, getMe } from '${ctrlImport}';
import { authMiddleware } from '${mwImport}';

const router = Router();

router.post('/register', register);
router.post('/login',    login);
router.get('/me',        authMiddleware, getMe);

export default router;
`
		: `const express = require('express');
const { register, login, getMe } = require('${ctrlImport}');
const authMiddleware = require('${mwImport}');

const router = express.Router();

router.post('/register', register);
router.post('/login',    login);
router.get('/me',        authMiddleware, getMe);

module.exports = router;
`;
}

// This method is called when your extension is deactivated
export function deactivate() {}
