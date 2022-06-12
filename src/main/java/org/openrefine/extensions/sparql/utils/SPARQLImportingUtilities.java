
package org.openrefine.extensions.sparql.utils;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.zip.ZipException;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.apache.commons.fileupload.FileItem;
import org.apache.commons.fileupload.FileUploadException;
import org.apache.commons.fileupload.ProgressListener;
import org.apache.commons.fileupload.disk.DiskFileItemFactory;
import org.apache.commons.fileupload.servlet.ServletFileUpload;

import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.google.refine.importing.EncodingGuesser;
import com.google.refine.importing.FormatGuesser;
import com.google.refine.importing.ImportingJob;
import com.google.refine.importing.ImportingManager;
import com.google.refine.importing.ImportingManager.Format;
import com.google.refine.importing.ImportingUtilities;
import com.google.refine.importing.ImportingUtilities.Progress;
import com.google.refine.util.JSONUtilities;
import com.google.refine.util.ParsingUtilities;

public class SPARQLImportingUtilities {

    static public void loadDataAndPrepareJob(
            HttpServletRequest request,
            HttpServletResponse response,
            Properties parameters,
            final ImportingJob job,
            ObjectNode config) throws IOException, ServletException {

        ObjectNode retrievalRecord = ParsingUtilities.mapper.createObjectNode();
        JSONUtilities.safePut(config, "retrievalRecord", retrievalRecord);
        JSONUtilities.safePut(config, "state", "loading-raw-data");

        final ObjectNode progress = ParsingUtilities.mapper.createObjectNode();
        JSONUtilities.safePut(config, "progress", progress);
        try {
            SPARQLImportingUtilities.retrieveContentFromPostRequest(
                    request,
                    parameters,
                    job.getRawDataDir(),
                    retrievalRecord,
                    new Progress() {

                        @Override
                        public void setProgress(String message, int percent) {
                            if (message != null) {
                                JSONUtilities.safePut(progress, "message", message);
                            }
                            JSONUtilities.safePut(progress, "percent", percent);
                        }

                        @Override
                        public boolean isCanceled() {
                            return job.canceled;
                        }
                    });
        } catch (Exception e) {
            JSONUtilities.safePut(config, "state", "error");
            JSONUtilities.safePut(config, "error", "Error uploading data");
            JSONUtilities.safePut(config, "errorDetails", e.getLocalizedMessage());
            throw new IOException(e.getMessage());
        }

        ArrayNode fileSelectionIndexes = ParsingUtilities.mapper.createArrayNode();
        JSONUtilities.safePut(config, "fileSelection", fileSelectionIndexes);

        EncodingGuesser.guess(job);

        String bestFormat = ImportingUtilities.autoSelectFiles(job, retrievalRecord, fileSelectionIndexes);
        bestFormat = SPARQLImportingUtilities.guessBetterFormat(job, bestFormat);

        ArrayNode rankedFormats = ParsingUtilities.mapper.createArrayNode();
        SPARQLImportingUtilities.rankFormats(job, bestFormat, rankedFormats);
        JSONUtilities.safePut(config, "rankedFormats", rankedFormats);

        JSONUtilities.safePut(config, "state", "ready");
        JSONUtilities.safePut(config, "hasData", true);
        config.remove("progress");
    }

    static void rankFormats(ImportingJob job, final String bestFormat, ArrayNode rankedFormats) {
        final Map<String, String[]> formatToSegments = new HashMap<String, String[]>();

        boolean download = bestFormat == null ? true : ImportingManager.formatToRecord.get(bestFormat).download;

        List<String> formats = new ArrayList<String>(ImportingManager.formatToRecord.keySet().size());
        for (String format : ImportingManager.formatToRecord.keySet()) {
            Format record = ImportingManager.formatToRecord.get(format);
            if (record.uiClass != null && record.parser != null && record.download == download) {
                formats.add(format);
                formatToSegments.put(format, format.split("/"));
            }
        }

        if (bestFormat == null) {
            Collections.sort(formats);
        } else {
            Collections.sort(formats, new Comparator<String>() {

                @Override
                public int compare(String format1, String format2) {
                    if (format1.equals(bestFormat)) {
                        return -1;
                    } else if (format2.equals(bestFormat)) {
                        return 1;
                    } else {
                        return compareBySegments(format1, format2);
                    }
                }

                int compareBySegments(String format1, String format2) {
                    int c = commonSegments(format2) - commonSegments(format1);
                    return c != 0 ? c : format1.compareTo(format2);
                }

                int commonSegments(String format) {
                    String[] bestSegments = formatToSegments.get(bestFormat);
                    String[] segments = formatToSegments.get(format);
                    if (bestSegments == null || segments == null) {
                        return 0;
                    } else {
                        int i;
                        for (i = 0; i < bestSegments.length && i < segments.length; i++) {
                            if (!bestSegments[i].equals(segments[i])) {
                                break;
                            }
                        }
                        return i;
                    }
                }
            });
        }

        for (String format : formats) {
            rankedFormats.add(format);
        }
    }

    static String guessBetterFormat(ImportingJob job, String bestFormat) {
        ObjectNode retrievalRecord = job.getRetrievalRecord();
        return retrievalRecord != null ? guessBetterFormat(job, retrievalRecord, bestFormat) : bestFormat;
    }

    static String guessBetterFormat(ImportingJob job, ObjectNode retrievalRecord, String bestFormat) {
        ArrayNode fileRecords = JSONUtilities.getArray(retrievalRecord, "files");
        return fileRecords != null ? guessBetterFormat(job, fileRecords, bestFormat) : bestFormat;
    }

    static String guessBetterFormat(ImportingJob job, ArrayNode fileRecords, String bestFormat) {
        if (bestFormat != null && fileRecords != null && fileRecords.size() > 0) {
            ObjectNode firstFileRecord = JSONUtilities.getObjectElement(fileRecords, 0);
            String encoding = ImportingUtilities.getEncoding(firstFileRecord);
            String location = JSONUtilities.getString(firstFileRecord, "location", null);

            if (location != null) {
                File file = new File(job.getRawDataDir(), location);

                while (true) {
                    String betterFormat = null;

                    List<FormatGuesser> guessers = ImportingManager.formatToGuessers.get(bestFormat);
                    if (guessers != null) {
                        for (FormatGuesser guesser : guessers) {
                            betterFormat = guesser.guess(file, encoding, bestFormat);
                            if (betterFormat != null) {
                                break;
                            }
                        }
                    }

                    if (betterFormat != null && !betterFormat.equals(bestFormat)) {
                        bestFormat = betterFormat;
                    } else {
                        break;
                    }
                }
            }
        }
        return bestFormat;
    }

    static public void retrieveContentFromPostRequest(
            HttpServletRequest request,
            Properties parameters,
            File rawDataDir,
            ObjectNode retrievalRecord,
            final Progress progress) throws IOException, FileUploadException {
        ArrayNode fileRecords = ParsingUtilities.mapper.createArrayNode();
        JSONUtilities.safePut(retrievalRecord, "files", fileRecords);

        int sparqlCount = 0;

        // This tracks the total progress, which involves uploading data from the client
        // as well as downloading data from URLs.
        final SavingUpdate update = new SavingUpdate() {

            @Override
            public void savedMore() {
                progress.setProgress(null, calculateProgressPercent(totalExpectedSize, totalRetrievedSize));
            }

            @Override
            public boolean isCanceled() {
                return progress.isCanceled();
            }
        };

        DiskFileItemFactory fileItemFactory = new DiskFileItemFactory();

        ServletFileUpload upload = new ServletFileUpload(fileItemFactory);
        upload.setProgressListener(new ProgressListener() {

            boolean setContentLength = false;
            long lastBytesRead = 0;

            @Override
            public void update(long bytesRead, long contentLength, int itemCount) {
                if (!setContentLength) {
                    // Only try to set the content length if we really know it.
                    if (contentLength >= 0) {
                        update.totalExpectedSize += contentLength;
                        setContentLength = true;
                    }
                }
                if (setContentLength) {
                    update.totalRetrievedSize += (bytesRead - lastBytesRead);
                    lastBytesRead = bytesRead;

                    update.savedMore();
                }
            }
        });

        List<FileItem> tempFiles = upload.parseRequest(request);

        progress.setProgress("Uploading data ...", -1);
        parts: for (FileItem fileItem : tempFiles) {
            if (progress.isCanceled()) {
                break;
            }

            InputStream stream = fileItem.getInputStream();

            String encoding = request.getCharacterEncoding();
            if (encoding == null) {
                encoding = "UTF-8";
            }

            File file = ImportingUtilities.allocateFile(rawDataDir, "sparql.txt");

            ObjectNode fileRecord = ParsingUtilities.mapper.createObjectNode();
            JSONUtilities.safePut(fileRecord, "origin", "sparql");
            JSONUtilities.safePut(fileRecord, "declaredEncoding", encoding);
            JSONUtilities.safePut(fileRecord, "declaredMimeType", (String) null);
            JSONUtilities.safePut(fileRecord, "format", "text");
            JSONUtilities.safePut(fileRecord, "fileName", "sparql");
            JSONUtilities.safePut(fileRecord, "location", ImportingUtilities.getRelativePath(file, rawDataDir));

            JSONUtilities.safePut(fileRecord, "size", saveStreamToFile(stream, file, null));
            JSONUtilities.append(fileRecords, fileRecord);

            sparqlCount++;
        }

        // Delete all temp files.
        for (FileItem fileItem : tempFiles) {
            fileItem.delete();
        }

        JSONUtilities.safePut(retrievalRecord, "sparqlCount", sparqlCount);
    }

    static private abstract class SavingUpdate {

        public long totalExpectedSize = 0;
        public long totalRetrievedSize = 0;

        abstract public void savedMore();

        abstract public boolean isCanceled();
    }

    static private long saveStreamToFile(InputStream stream, File file, SavingUpdate update) throws IOException {
        long length = 0;
        FileOutputStream fos = new FileOutputStream(file);
        try {
            byte[] bytes = new byte[16 * 1024];
            int c;
            while ((update == null || !update.isCanceled()) && (c = stream.read(bytes)) > 0) {
                fos.write(bytes, 0, c);
                length += c;

                if (update != null) {
                    update.totalRetrievedSize += c;
                    update.savedMore();
                }
            }
            return length;
        } catch (ZipException e) {
            throw new IOException("Compression format not supported, " + e.getMessage());
        } finally {
            fos.close();
        }
    }

    static private int calculateProgressPercent(long totalExpectedSize, long totalRetrievedSize) {
        return totalExpectedSize == 0 ? -1 : (int) (totalRetrievedSize * 100 / totalExpectedSize);
    }

}
