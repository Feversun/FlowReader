export interface CollectionItem {
    id: string;
    content: string;
    html?: string;
    type: 'text' | 'image' | 'code' | 'quote' | 'heading' | 'list';
    source: {
        url: string;
        title: string;
        favicon?: string;
    };
    timestamp: number;
}
