import { useState, useRef, useEffect } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL, fetchFile } from "@ffmpeg/util";
import { Dropzone } from "./components/ui/dropzone";

function App() {
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [loaded, setLoaded] = useState(false);
	const [compressing, setCompressing] = useState(false);
	const [originalSize, setOriginalSize] = useState<string>("");
	const [compressedSize, setCompressedSize] = useState<string>("");
	const ffmpegRef = useRef(new FFmpeg());
	const originalVideoRef = useRef<HTMLVideoElement | null>(null);
	const compressedVideoRef = useRef<HTMLVideoElement | null>(null);
	const messageRef = useRef<HTMLParagraphElement | null>(null);

	const load = async () => {
		const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm";
		const ffmpeg = ffmpegRef.current;

		ffmpeg.on("log", ({ message }) => {
			if (messageRef.current) messageRef.current.innerText = message;
		});

		await ffmpeg.load({
			coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
			wasmURL: await toBlobURL(
				`${baseURL}/ffmpeg-core.wasm`,
				"application/wasm"
			),
			workerURL: await toBlobURL(
				`${baseURL}/ffmpeg-core.js`,
				"text/javascript"
			),
		});

		setLoaded(true);
	};

	const formatSize = (bytes: number): string => {
		const sizes = ["Bytes", "KB", "MB", "GB"];
		if (bytes === 0) return "0 Byte";
		const i = Math.floor(Math.log(bytes) / Math.log(1024));
		return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
	};

	const transcode = async (file: File) => {
		setCompressing(true);
		setOriginalSize(formatSize(file.size));
		const ffmpeg = ffmpegRef.current;
		const inputFile = file.name;
		const outputFile = `compressed_${file.name.split(".")[0]}.mp4`;

		try {
			// Cleanup previous
			try {
				await ffmpeg.deleteFile(inputFile);
				await ffmpeg.deleteFile(outputFile);
			} catch {}

			await ffmpeg.writeFile(inputFile, await fetchFile(file));

			// Set original video
			if (originalVideoRef.current) {
				if (originalVideoRef.current.src) {
					URL.revokeObjectURL(originalVideoRef.current.src);
				}
				originalVideoRef.current.src = URL.createObjectURL(file);
			}

			await ffmpeg.exec([
				"-i",
				inputFile,
				"-vf",
				"scale=640:-1", // 👈 Resize to 640px wide, keep aspect ratio
				"-c:v",
				"libx264",
				"-crf",
				"40", // Higher CRF value for more compression
				"-preset",
				"ultrafast", // Fastest encoding
				"-tune",
				"fastdecode",
				"-c:a",
				"aac",
				"-b:a",
				"64k", // Lower audio bitrate for more compression
				"-threads",
				"0",
				outputFile,
			]);

			const data = await ffmpeg.readFile(outputFile);
			const blob = new Blob([data.buffer], { type: "video/mp4" });
			setCompressedSize(formatSize(blob.size));

			if (compressedVideoRef.current) {
				if (compressedVideoRef.current.src) {
					URL.revokeObjectURL(compressedVideoRef.current.src);
				}
				compressedVideoRef.current.src = URL.createObjectURL(blob);
			}

			await ffmpeg.deleteFile(inputFile);
			await ffmpeg.deleteFile(outputFile);
		} catch (error: any) {
			console.error("Transcode failed:", error);
			if (messageRef.current)
				messageRef.current.innerText = `Error: ${error.message}`;
		} finally {
			setCompressing(false);
		}
	};

	const handleFileSelect = async (files: FileList) => {
		const file = files[0];
		setSelectedFile(file);

		if (!loaded) {
			if (messageRef.current)
				messageRef.current.innerText = "Please wait while FFmpeg loads...";
			return;
		}

		await transcode(file);
	};

	useEffect(() => {
		load();
	}, []);

	return (
		<div className="min-h-screen flex mt-2 justify-center p-4">
			<div className="w-full max-w-6xl space-y-4">
				<Dropzone
					onFileSelect={(files) => {
						loaded && handleFileSelect(files);
					}}
					accept="video/*"
					maxSize={100 * 1024 * 1024}
					multiple={false}
				/>
				{selectedFile && (
					<div className="mt-4 space-y-4">
						<p ref={messageRef} className="text-sm text-gray-600"></p>
						{compressing && (
							<div className="text-sm text-blue-600">Compressing video...</div>
						)}
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<h3 className="text-lg font-semibold mb-2">
									Original Video ({originalSize})
								</h3>
								<video
									ref={originalVideoRef}
									controls
									className="w-full aspect-video bg-gray-100 rounded-lg"
								/>
							</div>
							<div>
								<h3 className="text-lg font-semibold mb-2">
									Compressed Video {compressedSize && `(${compressedSize})`}
								</h3>
								<video
									ref={compressedVideoRef}
									controls
									className="w-full aspect-video bg-gray-100 rounded-lg"
								/>
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

export default App;
