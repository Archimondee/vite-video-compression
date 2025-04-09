import { useState, useRef, useEffect } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL, fetchFile } from "@ffmpeg/util";
import { Dropzone } from "./components/ui/dropzone";

function App() {
	interface VideoFile {
		id: string;
		file: File;
		originalSize: string;
		compressedSize: string;
		status: "pending" | "compressing" | "done" | "error";
		errorMessage?: string;
		originalUrl?: string;
		compressedUrl?: string;
	}

	const [videoFiles, setVideoFiles] = useState<VideoFile[]>([]);
	const [loaded, setLoaded] = useState(false);
	const [activeCompressions, setActiveCompressions] = useState(0);
	const ffmpegRef = useRef(new FFmpeg());
	const originalVideoRef = useRef<HTMLVideoElement | null>(null);
	const compressedVideoRef = useRef<HTMLVideoElement | null>(null);
	const messageRef = useRef<HTMLParagraphElement | null>(null);

	const load = async () => {
		setLoaded(true);
		const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm";
		const ffmpeg = ffmpegRef.current;

		ffmpeg.on("log", ({ message }) => {
			if (messageRef.current) messageRef.current.innerText = message;
		});

		await ffmpeg
			.load({
				coreURL: await toBlobURL(
					`${baseURL}/ffmpeg-core.js`,
					"text/javascript"
				),
				wasmURL: await toBlobURL(
					`${baseURL}/ffmpeg-core.wasm`,
					"application/wasm"
				),
				workerURL: await toBlobURL(
					`${baseURL}/ffmpeg-core.js`,
					"text/javascript"
				),
			})
			.then(() => {
				setLoaded(false);
			});
	};

	const formatSize = (bytes: number): string => {
		const sizes = ["Bytes", "KB", "MB", "GB"];
		if (bytes === 0) return "0 Byte";
		const i = Math.floor(Math.log(bytes) / Math.log(1024));
		return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
	};

	const transcode = async (videoFile: VideoFile) => {
		setVideoFiles((prev) =>
			prev.map((f) =>
				f.id === videoFile.id ? { ...f, status: "compressing" } : f
			)
		);
		setActiveCompressions((prev) => prev + 1);

		const ffmpeg = ffmpegRef.current;
		const inputFile = videoFile.file.name;
		const outputFile = `compressed_${videoFile.file.name.split(".")[0]}.mp4`;

		// Clean up any existing URLs
		if (videoFile.compressedUrl) {
			URL.revokeObjectURL(videoFile.compressedUrl);
		}
		if (originalVideoRef.current?.src) {
			URL.revokeObjectURL(originalVideoRef.current.src);
			originalVideoRef.current.src = "";
		}
		if (compressedVideoRef.current?.src) {
			URL.revokeObjectURL(compressedVideoRef.current.src);
			compressedVideoRef.current.src = "";
		}

		try {
			// Cleanup previous FFmpeg files
			try {
				await ffmpeg.deleteFile(inputFile);
				await ffmpeg.deleteFile(outputFile);
			} catch {}

			await ffmpeg.writeFile(inputFile, await fetchFile(videoFile.file));

			// Set original video
			try {
				const originalBlobUrl = URL.createObjectURL(videoFile.file);
				if (originalVideoRef.current) {
					originalVideoRef.current.src = originalBlobUrl;
				}
			} catch (error) {
				console.error("Error creating blob URL for original video:", error);
			}

			await ffmpeg.exec([
				"-i",
				inputFile,
				"-vf",
				"scale='min(720,iw)':min'(720,ih)':force_original_aspect_ratio=decrease", // Scale to 720p with padding
				"-c:v",
				"libx264",
				"-crf",
				"28", // Balanced quality and compression
				"-preset",
				"ultrafast", // Better compression efficiency
				"-tune",
				"film", // Optimized for general video content
				"-c:a",
				"aac",
				"-b:a",
				"128k", // Better audio quality
				"-movflags",
				"+faststart", // Enable streaming
				"-threads",
				"0",
				outputFile,
			]);

			const data = await ffmpeg.readFile(outputFile);
			try {
				// @ts-ignore
				const blob = new Blob([data.buffer], { type: "video/mp4" });
				const compressedBlobUrl = URL.createObjectURL(blob);

				setVideoFiles((prev) =>
					prev.map((f) =>
						f.id === videoFile.id
							? {
									...f,
									status: "done",
									compressedSize: formatSize(blob.size),
									compressedUrl: compressedBlobUrl,
							  }
							: f
					)
				);
			} catch (error) {
				console.error("Error creating blob URL for compressed video:", error);
				setVideoFiles((prev) =>
					prev.map((f) =>
						f.id === videoFile.id
							? {
									...f,
									status: "error",
									errorMessage: "Error creating compressed video preview",
							  }
							: f
					)
				);
			}

			// Cleanup FFmpeg files
			await ffmpeg.deleteFile(inputFile);
			await ffmpeg.deleteFile(outputFile);
		} catch (error: any) {
			console.error("Transcode failed:", error);
			setVideoFiles((prev) =>
				prev.map((f) =>
					f.id === videoFile.id
						? { ...f, status: "error", errorMessage: error.message }
						: f
				)
			);
		} finally {
			setActiveCompressions((prev) => prev - 1);
		}
	};

	const handleFileSelect = async (files: FileList) => {
		if (loaded) {
			if (messageRef.current)
				messageRef.current.innerText = "Please wait while FFmpeg loads...";
			return;
		}

		const newFiles = Array.from(files).map((file) => ({
			id: Math.random().toString(36).substring(7),
			file,
			originalSize: formatSize(file.size),
			compressedSize: "",
			status: "pending" as const,
			originalUrl: URL.createObjectURL(file),
		}));

		setVideoFiles((prev) => [...prev, ...newFiles]);

		for (const videoFile of newFiles) {
			await transcode(videoFile);
		}
	};

	useEffect(() => {
		load();
	}, []);

	return (
		<div className="min-h-screen flex mt-2 justify-center p-4">
			<div className="w-full max-w-6xl space-y-4">
				<Dropzone
					onFileSelect={(files) => {
						!loaded && handleFileSelect(files);
					}}
					accept="video/*"
					maxSize={100 * 1024 * 1024}
					multiple={true}
					disabled={loaded}
				/>
				<div className="mt-4 space-y-4">
					<p ref={messageRef} className="text-sm text-gray-600"></p>
					{activeCompressions > 0 && (
						<div className="text-sm text-blue-600">
							Compressing {activeCompressions} video
							{activeCompressions > 1 ? "s" : ""}...
						</div>
					)}
					<div className="grid grid-cols-1 gap-8">
						{videoFiles.map((videoFile) => (
							<div
								key={videoFile.id}
								className="border rounded-lg p-4 space-y-4"
							>
								<div className="flex items-center justify-between">
									<h3 className="text-lg font-semibold">
										{videoFile.file.name}
									</h3>
									<div className="flex items-center space-x-2">
										{videoFile.status === "compressing" && (
											<span className="text-blue-600 text-sm">
												Compressing...
											</span>
										)}
										{videoFile.status === "done" && (
											<span className="text-green-600 text-sm">Done</span>
										)}
										{videoFile.status === "error" && (
											<span className="text-red-600 text-sm">
												{videoFile.errorMessage || "Error"}
											</span>
										)}
									</div>
								</div>
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div>
										<h4 className="text-sm font-medium mb-2">
											Original Video ({videoFile.originalSize})
										</h4>
										<video
											src={videoFile.originalUrl}
											controls
											className="w-full aspect-video bg-gray-100 rounded-lg"
										/>
									</div>
									<div>
										<h4 className="text-sm font-medium mb-2">
											Compressed Video{" "}
											{videoFile.compressedSize &&
												`(${videoFile.compressedSize})`}
										</h4>
										{videoFile.compressedUrl ? (
											<video
												src={videoFile.compressedUrl}
												controls
												className="w-full aspect-video bg-gray-100 rounded-lg"
											/>
										) : (
											<div className="w-full aspect-video bg-gray-100 rounded-lg flex items-center justify-center text-gray-500">
												{videoFile.status === "pending"
													? "Waiting..."
													: "Processing..."}
											</div>
										)}
									</div>
								</div>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}

export default App;
