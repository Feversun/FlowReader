import type { CollectionItem } from './types';

export const storage = {
    async getCollections(): Promise<CollectionItem[]> {
        const result = await chrome.storage.local.get(['collections']);
        return result.collections || [];
    },

    async saveCollection(item: CollectionItem): Promise<void> {
        const collections = await this.getCollections();
        collections.push(item);
        await chrome.storage.local.set({ collections });
    },

    async removeCollection(id: string): Promise<void> {
        const collections = await this.getCollections();
        const newCollections = collections.filter(c => c.id !== id);
        await chrome.storage.local.set({ collections: newCollections });
    },

    async clearCollections(): Promise<void> {
        await chrome.storage.local.set({ collections: [] });
    }
};
