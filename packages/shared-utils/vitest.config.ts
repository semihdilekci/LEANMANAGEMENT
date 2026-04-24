import { defineConfig, mergeConfig } from 'vitest/config';
import base from '@leanmgmt/config/vitest/base';

export default mergeConfig(base, defineConfig({}));
