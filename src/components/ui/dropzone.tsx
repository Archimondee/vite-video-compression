import * as React from "react";
import { cn } from "@/lib/utils";
import { Upload } from "lucide-react";

export interface DropzoneProps extends React.HTMLAttributes<HTMLDivElement> {
	onFileSelect?: (files: FileList) => void;
	accept?: string;
	maxSize?: number;
	multiple?: boolean;
}

const Dropzone = React.forwardRef<HTMLDivElement, DropzoneProps>(
	(
		{ className, onFileSelect, accept, maxSize, multiple = false, ...props },
		ref
	) => {
		const [isDragging, setIsDragging] = React.useState(false);

		const handleDragOver = React.useCallback(
			(e: React.DragEvent<HTMLDivElement>) => {
				e.preventDefault();
				e.stopPropagation();
				setIsDragging(true);
			},
			[]
		);

		const handleDragLeave = React.useCallback(
			(e: React.DragEvent<HTMLDivElement>) => {
				e.preventDefault();
				e.stopPropagation();
				setIsDragging(false);
			},
			[]
		);

		const handleDrop = React.useCallback(
			(e: React.DragEvent<HTMLDivElement>) => {
				e.preventDefault();
				e.stopPropagation();
				setIsDragging(false);

				const files = e.dataTransfer.files;
				if (!files.length) return;

				if (maxSize && Array.from(files).some((file) => file.size > maxSize)) {
					console.error("File size exceeds limit");
					return;
				}

				onFileSelect?.(files);
			},
			[maxSize, onFileSelect]
		);

		const handleFileSelect = React.useCallback(
			(e: React.ChangeEvent<HTMLInputElement>) => {
				const files = e.target.files;
				if (!files?.length) return;

				if (maxSize && Array.from(files).some((file) => file.size > maxSize)) {
					console.error("File size exceeds limit");
					return;
				}

				onFileSelect?.(files);
			},
			[maxSize, onFileSelect]
		);

		return (
			<div
				ref={ref}
				className={cn(
					"relative flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 p-4 transition-colors hover:bg-accent/5",
					isDragging && "border-primary bg-accent/5",
					className
				)}
				onDragOver={handleDragOver}
				onDragLeave={handleDragLeave}
				onDrop={handleDrop}
				{...props}
			>
				<input
					type="file"
					className="absolute inset-0 cursor-pointer opacity-0"
					onChange={handleFileSelect}
					accept={accept}
					multiple={multiple}
				/>
				<div className="flex flex-col items-center justify-center text-center">
					<Upload className="mb-4 h-10 w-10 text-muted-foreground" />
					<p className="mb-2 text-sm font-medium text-muted-foreground">
						Drag & drop files here, or click to select files
					</p>
					{accept && (
						<p className="text-xs text-muted-foreground/75">
							Allowed types: {accept}
						</p>
					)}
					{maxSize && (
						<p className="text-xs text-muted-foreground/75">
							Max size: {(maxSize / 1024 / 1024).toFixed(0)}MB
						</p>
					)}
				</div>
			</div>
		);
	}
);

Dropzone.displayName = "Dropzone";

export { Dropzone };
