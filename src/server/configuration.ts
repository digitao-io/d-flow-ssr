import fs from "node:fs";

export interface Configuration {
  staticPath: string;
  htmlTemplatePath: string;
  port: number;
}

export function readConfiguration<CONFIG extends Configuration>(configPath: string): CONFIG {
  if (!configPath) {
    throw Error("Invalid configuration path");
  }

  if (!fs.existsSync(configPath)) {
    throw Error(`Configuration path doesn't exist: ${configPath}`);
  }

  if (!fs.statSync(configPath).isFile()) {
    throw Error(`Configuration path isn't a file: ${configPath}`);
  }

  const configFileContent = fs.readFileSync(configPath, "utf-8");

  let config: CONFIG;
  try {
    config = JSON.parse(configFileContent);
  }
  catch {
    throw Error(`Cannot parse configuration: ${configPath}`);
  }

  return config;
}
