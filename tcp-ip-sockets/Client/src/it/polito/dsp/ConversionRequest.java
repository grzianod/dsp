package it.polito.dsp;

import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.Socket;
import java.nio.charset.StandardCharsets;

public class ConversionRequest {
	
	private static final int CHUNK_SIZE = 1024;
	private static final int TIMEOUT = 30*1000;
	
	private Socket socket;
	private DataOutputStream outputStream = null;
	private DataInputStream inputStream = null;
	
	private ConversionRequest(InetAddress address, int port) throws IOException {
	
		this.socket = new Socket(address, port);
		inputStream = new DataInputStream(socket.getInputStream());
		outputStream = new DataOutputStream(socket.getOutputStream());
		socket.setSoTimeout(TIMEOUT);
	
	}
	
	private void send(String input, String output, String filename) throws IOException {
		
		//sending request
		File file = new File("./image/"+filename);
		int fileSize = (int) file.length();
		byte [] fileBytes = new byte [CHUNK_SIZE];
		FileInputStream fis = new FileInputStream("./image/"+filename);
		
		
		byte [] bytes = input.getBytes(StandardCharsets.US_ASCII);
		outputStream.write(bytes);
		bytes = output.getBytes(StandardCharsets.US_ASCII);
		outputStream.write(bytes);
		System.out.println("Information about media types sent...");
				
		outputStream.writeInt(fileSize);
		System.out.println("Information about file size sent...");
		
		int count = 0;
		while((count = fis.read(fileBytes)) > 0) {
			outputStream.write(fileBytes, 0, count);
		}
		outputStream.flush();
		fis.close();
		System.out.println("File bytes sent...\n");
		
		//receiving response
		fileBytes = new byte [CHUNK_SIZE];
		ByteArrayOutputStream baos = new ByteArrayOutputStream();
		char isSuccess = (char) inputStream.readByte();
		switch(isSuccess) {
		case '0': 
			fileSize = inputStream.readInt();
			 int bytesToRead = fileSize;
			 
			 
			//read file chunks, until less than CHUNK_LENGTH bytes remain
			 while(fileSize > CHUNK_SIZE) {
				// System.out.println(fileSizeToRead);
				int readBytes = inputStream.read(fileBytes, 0, CHUNK_SIZE);
				baos.write(fileBytes, 0, readBytes);
				bytesToRead -= readBytes;
				fileSize = bytesToRead;
				fileBytes = new byte[CHUNK_SIZE];
			 }
			//read last chunk
			while(bytesToRead > 0) {
				int readBytes = inputStream.read(fileBytes, 0, bytesToRead);
				baos.write(fileBytes, 0, readBytes);
				bytesToRead -= readBytes;
				fileBytes = new byte[CHUNK_SIZE];
			}			 
			try(OutputStream outputStream = new FileOutputStream("image/output."+output.toLowerCase())) {
				baos.writeTo(outputStream);
				outputStream.close();
			}
			System.out.println("The converted file has been received.");
       	break;
		case '1': System.out.println("Wrong request");
					break;
		case '2': System.out.println("Internal Server Error");
					break;
		}
		
	}
	
	public static void main(String args[]) {
		if(args.length != 3) {
			System.out.println("Usage: inputFileType outputFileType file\n");
			System.exit(1);
		}
		
		if(!args[0].toUpperCase().matches("[A-Z]{3}")) {
			System.err.println("inputFileType must be 3 letters uppercase!\n");
			System.exit(2);
		}
		
		if(!args[1].toUpperCase().matches("[A-Z]{3}")) {
			System.err.println("outputFileType must be 3 letters uppercase!\n");
			System.exit(3);
		}
		
		File file = new File("./image/" + args[2]);
		if(!file.exists()) {
			System.err.println("The file \"" + args[2] + "\" does not exists!");
			System.exit(4);
		}
		
		ConversionRequest client = null;
		try{
			client = new ConversionRequest(InetAddress.getByName("localhost"), 2001);
			System.out.println("Input: "+args[0]+ " Output: "+args[1]+" File: "+args[2]);
			System.out.println("Connected to the server: "+client.socket.getInetAddress()+":"+client.socket.getPort());
		}
		catch(Exception e) {
			System.err.println("Error when connecting to server");
			e.printStackTrace();
			System.exit(5);
		}
		
		try {
			client.send(args[0], args[1], args[2]);
		}
		catch(Exception e) {
			System.err.println("Error sending conversion request");
			e.printStackTrace();
			System.exit(6);
		}
		
	}
	
}

