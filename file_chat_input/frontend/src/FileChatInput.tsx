import "./component.css";

import {
  Streamlit,
  StreamlitComponentBase,
  withStreamlitConnection,
} from "streamlit-component-lib";
import React, { ReactNode } from "react";

interface FileWithPreview extends File {
  previewUrl: string;
  originalFile: File;
  uploadedChunks: number;
  isDownloading: boolean;
  totalChunks: number; // Total chunks for the file
}

interface State {
  isFocused: boolean;
  message: string;
  files: FileWithPreview[];
  isWindowExpanded: boolean; // State to manage the expand/collapse of the window
}

class FileChatInput extends StreamlitComponentBase<State> {
  public state = { message: "", isFocused: false, files: [], isWindowExpanded: false };

  private baseChunkSize = 1024 * 1024; // 1 MB base chunk size

  public render = (): ReactNode => {
    const hint = this.props.args["hint"];
    const previewHeight = "80px";
    const { theme } = this.props;
    const style: React.CSSProperties = {};

    if (theme) {
      const borderStyling = `1px solid ${
        this.state.isFocused ? theme.primaryColor : "gray"
      }`;
      style.border = borderStyling;
      style.outline = borderStyling;
    }

    return (
      <div
        style={{
          display: "flex",
          width: "100%",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Collapsible Window */}
        <div
          style={{
            maxHeight: this.state.isWindowExpanded ? "200px" : "0px",
            overflow: "hidden",
            transition: "max-height 0.3s ease-out",
            width: "100%",
            backgroundColor: "#f8f9fa",
            border: "1px solid #ddd",
            marginBottom: "10px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              width: "100%",
              alignItems: "center",
              padding: "5px",
              justifyContent: "flex-start",
            }}
          >
            {this.state.files.map((file: FileWithPreview, index) => (
              <div
                key={index}
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  marginRight: "5px",
                }}
              >
                <img
                  src={file.previewUrl}
                  style={{ maxWidth: previewHeight, maxHeight: previewHeight }}
                  alt="preview"
                />
                {file.isDownloading && (
                  <div
                    style={{
                      width: "15px",
                      height: "15px",
                      borderRadius: "50%",
                      backgroundColor: "green",
                      marginLeft: "5px",
                      animation: "spin 1s linear infinite",
                    }}
                  />
                )}
                <button
                  style={{
                    position: "absolute",
                    top: "0",
                    right: "0",
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0",
                  }}
                  onClick={() => this.removeFile(file)}
                >
                  ✖
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Button to toggle the window */}
        <button
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            marginBottom: "5px",
          }}
          onClick={() =>
            this.setState((prevState) => ({
              isWindowExpanded: !prevState.isWindowExpanded,
            }))
          }
        >
          {this.state.isWindowExpanded ? "⬆️" : "⬇️"}
        </button>

        {/* Chat Input Section */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            width: "100%",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <input
            type="file"
            id="fileInput"
            style={{ display: "none" }}
            multiple
            onChange={this.handleFileChange}
          />

          <button
            className="message-input__button"
            onClick={() => {
              const fileInput = document.getElementById("fileInput");
              if (fileInput) fileInput.click();
            }}
          >
            📎
          </button>
          <input
            type="text"
            className="message-input__input"
            placeholder={hint}
            onChange={this.handleMessageChange}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                this.onClicked();
              }
            }}
            value={this.state.message}
          />
          <button
            onClick={this.onClicked}
            type="button"
            className="message-input__button"
          >
            🚀
          </button>
        </div>
      </div>
    );
  };

  private resetFileInput = (): void => {
    const fileInput = document.getElementById("fileInput") as HTMLInputElement;
    if (fileInput) {
      fileInput.value = "";
    }
  };

  private removeFile = (fileToRemove: FileWithPreview): void => {
    URL.revokeObjectURL(fileToRemove.previewUrl);
    this.setState((prevState: any) => ({
      files: prevState.files.filter(
        (file: FileWithPreview) => file !== fileToRemove
      ),
    }));

    this.resetFileInput();
  };

  private handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ): void => {
    const filesWithPreview = event.target.files
      ? Array.from(event.target.files).map((file) => {
          const previewUrl = URL.createObjectURL(file);
          const totalChunks = Math.ceil(file.size / this.baseChunkSize); // Calculate total chunks
          return {
            ...file,
            previewUrl,
            originalFile: file,
            uploadedChunks: 0,
            isDownloading: true,
            totalChunks,
          };
        })
      : [];

    this.setState((prevState: any) => ({
      files: [...prevState.files, ...filesWithPreview],
    }));
  };

  private handleMessageChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ): void => {
    this.setState({ message: event.target.value });
  };

  private calculateChunkSize = (numFiles: number): number => {
    // Dynamically adjust chunk size based on the number of files
    // Reduce chunk size as the number of files increases
    return Math.max(this.baseChunkSize / numFiles, 1024 * 256); // Minimum chunk size is 256 KB
  };

  private uploadChunks = async (file: FileWithPreview): Promise<void> => {
    const fileSize = file.size;
    let offset = 0;
    const chunkSize = this.calculateChunkSize(this.state.files.length); // Adjust chunk size dynamically

    while (offset < fileSize) {
      const chunk = file.slice(offset, offset + chunkSize);
      const chunkContent = await this.fileToBase64(chunk);
      Streamlit.setComponentValue({
        chunkContent,
        chunkIndex: offset / chunkSize,
        fileName: file.name,
        isLastChunk: offset + chunkSize >= fileSize,
      });
      offset += chunkSize;
      file.uploadedChunks += 1;

      // Update file's progress
      this.setState((prevState: State) => ({
        files: prevState.files.map((f) =>
          f === file ? { ...f, uploadedChunks: file.uploadedChunks } : f
        ),
      }));
    }

    // Set the download status to false once upload is done
    this.setState((prevState: State) => ({
      files: prevState.files.map((f) =>
        f === file ? { ...f, isDownloading: false } : f
      ),
    }));
  };

  private onClicked = async (): Promise<void> => {
    const { files, message } = this.state;
    if (files.length > 0 || message) {
      // Upload all files concurrently
      await Promise.all(files.map((file) => this.uploadChunks(file)));
      Streamlit.setComponentValue({ message });
    }

    this.setState({ files: [], message: "" });
    this.resetFileInput();
    document
      .querySelectorAll('div[style*="position: relative;"]')
      .forEach((element) => element.remove());
  };

  private fileToBase64 = (file: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  };
}

export default withStreamlitConnection(FileChatInput);
