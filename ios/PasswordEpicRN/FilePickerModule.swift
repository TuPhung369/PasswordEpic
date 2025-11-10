import Foundation
import React
import UIKit
import UniformTypeIdentifiers

@objc(FilePickerModule)
class FilePickerModule: NSObject, RCTBridgeModule {
  
  static func moduleName() -> String! {
    return "FilePicker"
  }
  
  static func requiresMainQueueSetup() -> Bool {
    return true
  }
  
  @objc var bridge: RCTBridge!
  
  private var pickFilePromise: RCTPromiseResolveBlock?
  private var pickFileReject: RCTPromiseRejectBlock?
  private var pickFolderPromise: RCTPromiseResolveBlock?
  private var pickFolderReject: RCTPromiseRejectBlock?
  private var documentPickerDelegate: DocumentPickerDelegate?
  
  @objc
  func pickFile(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    let options: [String: Any] = [:]
    pickFileWithOptions(options, resolve: resolve, rejecter: reject)
  }
  
  @objc
  func pickFileWithOptions(_ options: NSDictionary, resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      self.pickFilePromise = resolve
      self.pickFileReject = reject
      
      let fileType = options["fileType"] as? String ?? "public.item"
      var documentTypes: [UTType] = []
      
      if fileType == "*/*" {
        documentTypes = [.item]
      } else if let utType = UTType(filenameExtension: fileType) {
        documentTypes = [utType]
      } else {
        documentTypes = [.item]
      }
      
      guard let rootViewController = self.getRootViewController() else {
        reject("FILE_PICKER_ERROR", "Root view controller not found", nil)
        return
      }
      
      let documentPicker = UIDocumentPickerViewController(forOpeningContentTypes: documentTypes)
      self.documentPickerDelegate = DocumentPickerDelegate(
        fileResolved: { path in
          resolve(path)
          self.pickFilePromise = nil
          self.pickFileReject = nil
        },
        folderResolved: { path in },
        cancelled: {
          resolve("")
          self.pickFilePromise = nil
          self.pickFileReject = nil
        },
        error: { errorMsg, err in
          reject("FILE_PICKER_ERROR", errorMsg, err)
          self.pickFilePromise = nil
          self.pickFileReject = nil
        }
      )
      documentPicker.delegate = self.documentPickerDelegate
      documentPicker.allowsMultipleSelection = false
      
      rootViewController.present(documentPicker, animated: true)
    }
  }
  
  @objc
  func pickFolder(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      self.pickFolderPromise = resolve
      self.pickFolderReject = reject
      
      guard let rootViewController = self.getRootViewController() else {
        reject("FOLDER_PICKER_ERROR", "Root view controller not found", nil)
        return
      }
      
      let documentPicker = UIDocumentPickerViewController(forOpeningContentTypes: [.folder])
      self.documentPickerDelegate = DocumentPickerDelegate(
        fileResolved: { path in },
        folderResolved: { path in
          resolve(path)
          self.pickFolderPromise = nil
          self.pickFolderReject = nil
        },
        cancelled: {
          resolve("")
          self.pickFolderPromise = nil
          self.pickFolderReject = nil
        },
        error: { errorMsg, err in
          reject("FOLDER_PICKER_ERROR", errorMsg, err)
          self.pickFolderPromise = nil
          self.pickFolderReject = nil
        }
      )
      documentPicker.delegate = self.documentPickerDelegate
      documentPicker.allowsMultipleSelection = false
      
      rootViewController.present(documentPicker, animated: true)
    }
  }

  @objc
  func writeToFolder(_ folderPath: String, fileName: String, content: String, resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      do {
        let folderURL = URL(fileURLWithPath: folderPath)
        let fileURL = folderURL.appendingPathComponent(fileName)
        
        try content.write(to: fileURL, atomically: true, encoding: .utf8)
        
        resolve(fileURL.path)
      } catch {
        reject("WRITE_ERROR", "Failed to write file: \(error.localizedDescription)", error)
      }
    }
  }
  
  private func getRootViewController() -> UIViewController? {
    let scenes = UIApplication.shared.connectedScenes
    guard let windowScene = scenes.first(where: { $0 is UIWindowScene }) as? UIWindowScene else {
      return nil
    }
    return windowScene.windows.first?.rootViewController
  }
}

class DocumentPickerDelegate: NSObject, UIDocumentPickerDelegate {
  private let fileResolved: (String) -> Void
  private let folderResolved: (String) -> Void
  private let cancelled: () -> Void
  private let error: (String, Error?) -> Void
  
  init(fileResolved: @escaping (String) -> Void,
       folderResolved: @escaping (String) -> Void,
       cancelled: @escaping () -> Void,
       error: @escaping (String, Error?) -> Void) {
    self.fileResolved = fileResolved
    self.folderResolved = folderResolved
    self.cancelled = cancelled
    self.error = error
  }
  
  func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
    guard let url = urls.first else {
      cancelled()
      return
    }
    
    do {
      let resourceValues = try url.resourceValues(forKeys: [.isDirectoryKey])
      let isDirectory = resourceValues.isDirectory ?? false
      
      if isDirectory {
        folderResolved(url.path)
      } else {
        let data = try Data(contentsOf: url)
        let tempDirectory = FileManager.default.temporaryDirectory
        let tempFileName = "temp_import_\(Date().timeIntervalSince1970).json"
        let tempFileURL = tempDirectory.appendingPathComponent(tempFileName)
        
        try data.write(to: tempFileURL)
        fileResolved(tempFileURL.path)
      }
    } catch {
      self.error("Failed to process selection: \(error.localizedDescription)", error)
    }
  }
  
  func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
    cancelled()
  }
}
