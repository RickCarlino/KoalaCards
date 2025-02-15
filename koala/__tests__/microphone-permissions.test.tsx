import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import MicrophonePermissions from "../microphone-permissions";

describe("MicrophonePermissions", () => {
  const mockGetUserMedia = jest.fn();

  beforeEach(() => {
    // Mock the navigator.mediaDevices API
    Object.defineProperty(global.navigator, "mediaDevices", {
      value: {
        getUserMedia: mockGetUserMedia,
      },
      writable: true,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("shows waiting message while requesting permissions", () => {
    mockGetUserMedia.mockImplementation(() => new Promise(() => {})); // Never resolves
    const TestComponent = () => MicrophonePermissions(<div>Test Content</div>);
    render(<TestComponent />);

    expect(
      screen.getByText("Requesting microphone permission..."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Please allow microphone access to continue"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Test Content")).not.toBeInTheDocument();
  });

  it("renders child element after permissions granted", async () => {
    mockGetUserMedia.mockResolvedValue({}); // Mock successful permission

    const TestComponent = () => MicrophonePermissions(<div>Test Content</div>);
    render(<TestComponent />);

    // Initially shows waiting message
    expect(
      screen.getByText("Requesting microphone permission..."),
    ).toBeInTheDocument();

    // Wait for permissions to be granted
    expect(await screen.findByText("Test Content")).toBeInTheDocument();
    expect(
      screen.queryByText("Requesting microphone permission..."),
    ).not.toBeInTheDocument();
  });

  it("shows error message when permission denied", async () => {
    const errorMessage = "Permission denied";
    mockGetUserMedia.mockRejectedValue(new Error(errorMessage));

    const TestComponent = () => MicrophonePermissions(<div>Test Content</div>);
    render(<TestComponent />);

    // Initially shows waiting message
    expect(
      screen.getByText("Requesting microphone permission..."),
    ).toBeInTheDocument();

    // Wait for error state
    expect(
      await screen.findByText("Microphone Access Error"),
    ).toBeInTheDocument();
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
    expect(screen.queryByText("Test Content")).not.toBeInTheDocument();
  });

  it("shows generic error message when no specific error provided", async () => {
    mockGetUserMedia.mockRejectedValue(new Error());

    const TestComponent = () => MicrophonePermissions(<div>Test Content</div>);
    render(<TestComponent />);

    // Wait for error state
    expect(
      await screen.findByText("Microphone Access Error"),
    ).toBeInTheDocument();
    expect(screen.getByText("Failed to access microphone")).toBeInTheDocument();
    expect(screen.queryByText("Test Content")).not.toBeInTheDocument();
  });
});
