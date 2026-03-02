export interface KeepListItem {
    text: string;
    isChecked: boolean;
}

export interface KeepAttachment {
    filePath: string;
    mimetype: string;
}

export interface KeepAnnotation {
    description: string;
    source: string;
    title: string;
    url: string;
}

export interface KeepNote {
    color: string;
    isTrashed: boolean;
    isPinned: boolean;
    isArchived: boolean;
    textContent?: string;
    title: string;
    userEditedTimestampUsec: number;
    createdTimestampUsec: number;
    annotations?: KeepAnnotation[];
    listContent?: KeepListItem[];
    attachments?: KeepAttachment[];
    labels?: { name: string }[];
}
