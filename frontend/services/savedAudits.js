import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAuditStore } from './savedAuditStore';

export const savedAudits = createAuditStore(AsyncStorage);
